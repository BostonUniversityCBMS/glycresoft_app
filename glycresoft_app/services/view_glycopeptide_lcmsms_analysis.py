from collections import OrderedDict

from flask import Response, g, request, render_template, jsonify
from .service_module import register_service

from threading import RLock
from glycresoft_app.utils.state_transfer import request_arguments_and_context, FilterSpecificationSet
from glycresoft_app.utils.pagination import SequencePagination
from glycresoft_app import report

from glycan_profiling.serialize import (
    Analysis, Protein, Glycopeptide, GlycanCombination,
    IdentifiedGlycopeptide, func,
    MSScan)

from glycan_profiling.tandem.glycopeptide.scoring.binomial_score import BinomialSpectrumMatcher

from glycan_profiling.tandem.glycopeptide.identified_structure import IdentifiedGlycoprotein

from glycan_profiling.serialize.hypothesis.glycan import GlycanCombinationGlycanComposition
from weakref import WeakValueDictionary


from glycan_profiling.database.glycan_composition_filter import (
    GlycanCompositionFilter, InclusionFilter)

from glycan_profiling.plotting.summaries import (
    SmoothingChromatogramArtist,
    figax)

from glycan_profiling.output import GlycopeptideLCMSMSAnalysisCSVSerializer

from glycan_profiling.plotting.plot_glycoforms import plot_glycoforms_svg
from glycan_profiling.plotting.sequence_fragment_logo import glycopeptide_match_logo

from glycan_profiling.plotting.entity_bar_chart import (
    AggregatedAbundanceArtist, BundledGlycanComposition)

app = view_glycopeptide_lcmsms_analysis = register_service("view_glycopeptide_lcmsms_analysis", __name__)


VIEW_CACHE = dict()


class GlycopeptideSnapShot(object):
    def __init__(self, protein_id, score_threshold, glycan_filters, members):
        self.protein_id = protein_id
        self.score_threshold = score_threshold
        self.glycan_filters = glycan_filters
        self.members = sorted(members, key=lambda x: x.ms2_score, reverse=True)
        self.member_id_map = {m.id: m for m in members}
        self.figure_axes = {}
        self._glycoprotein = None

    def get_glycoprotein(self, session):
        if self._glycoprotein is None:
            protein = session.query(Protein).get(self.protein_id)
            self._glycoprotein = IdentifiedGlycoprotein(protein, self.members)
        return self._glycoprotein

    def is_valid(self, score_threshold, glycan_filters):
        if self.score_threshold != score_threshold:
            return False
        if self.glycan_filters != glycan_filters:
            return False
        return True

    def __iter__(self):
        return iter(self.members)

    def __len__(self):
        return len(self.members)

    def paginate(self, page, per_page=50):
        return SequencePagination.paginate(self.members, page, per_page)

    def __getitem__(self, i):
        return self.member_id_map[i]

    def plot_glycoforms(self, session):
        try:
            svg = self.figure_axes['plot_glycoforms']
            return svg
        except KeyError:
            protein = session.query(Protein).get(self.protein_id)
            ax = figax()
            svg = plot_glycoforms_svg(protein, self.members, ax=ax)
            self.figure_axes['plot_glycoforms'] = svg
            return svg

    def site_specific_glycosylation(self, session):
        try:
            axes = self.figure_axes['site_specific_glycosylation']
            return axes
        except KeyError:
            glycoprot = self.get_glycoprotein(session)
            axes = OrderedDict()
            for site in sorted(glycoprot.glycosylation_sites):
                spanning_site = glycoprot.site_map[site]
                if len(spanning_site) == 0:
                    continue
                bundle = BundledGlycanComposition.aggregate(spanning_site)
                ax = figax()
                AggregatedAbundanceArtist(bundle, ax=ax).draw()
                axes[site] = ax
            return axes


class GlycopeptideAnalysisView(object):
    def __init__(self, session, analysis_id):
        self.analysis_id = analysis_id
        self.session = session
        self.protein_index = None
        self.glycan_composition_filter = None
        self.monosaccharide_bounds = FilterSpecificationSet()
        self.score_threshold = 50
        self.analysis = None
        self.hypothesis = None

        self._converted_cache = WeakValueDictionary()

        self._resolve_sources()
        self._build_protein_index()
        self._build_glycan_filter()

        self._snapshots_lock = RLock()
        self._snapshots = dict()

    def _snapshot_size(self):
        return sum(map(len, self._snapshots.values()))

    def _snapshot_upkeep(self, max_size=5e2):
        if self._snapshot_size() > max_size:
            pass
            # TODO switch from using a plain dict to using
            # something connected to an LRU cache

    def _resolve_sources(self):
        self.analysis = self.session.query(Analysis).get(self.analysis_id)
        self.hypothesis = self.analysis.hypothesis

    def _build_protein_index(self):
        theoretical_counts = self.session.query(Protein.name, Protein.id, func.count(Glycopeptide.id)).join(
            Glycopeptide).group_by(Protein.id).filter(
            Protein.hypothesis_id == self.hypothesis.id).all()
        matched_counts = self.session.query(Protein.name, Protein.id, func.count(IdentifiedGlycopeptide.id)).join(
            Glycopeptide).join(
            IdentifiedGlycopeptide, IdentifiedGlycopeptide.structure_id == Glycopeptide.id).group_by(
            Protein.id).filter(
            IdentifiedGlycopeptide.ms2_score > self.score_threshold,
            IdentifiedGlycopeptide.analysis_id == self.analysis_id).all()
        listing = []
        index = {}
        for protein_name, protein_id, glycopeptide_count in theoretical_counts:
            index[protein_id] = {
                "protein_name": protein_name,
                "protein_id": protein_id,
                "theoretical_count": glycopeptide_count
            }
        for protein_name, protein_id, glycopeptide_count in matched_counts:
            entry = index[protein_id]
            entry['identified_glycopeptide_count'] = glycopeptide_count
            listing.append(entry)
        self.protein_index = sorted(listing, key=lambda x: x["identified_glycopeptide_count"], reverse=True)
        for protein_entry in self.protein_index:
            protein_entry['protein'] = self.session.query(Protein).get(protein_entry["protein_id"])
        return self.protein_index

    def _build_glycan_filter(self):
        self.glycan_composition_filter = GlycanCompositionFilter(self.hypothesis.glycan_hypothesis.glycans.all())

    def filter_glycan_combinations(self):
        if len(self.monosaccharide_bounds) == 0:
            ids = self.session.query(GlycanCombination.id).filter(
                GlycanCombination.hypothesis_id == self.hypothesis.id).all()
            return [i[0] for i in ids]

        query = self.monosaccharide_bounds.to_filter_query(self.glycan_composition_filter)
        inclusion_filter = InclusionFilter(query)

        keepers = []
        last_combination_id = None
        keep = True
        for rel in self.session.query(GlycanCombinationGlycanComposition).join(GlycanCombination).filter(
                GlycanCombination.hypothesis_id == self.hypothesis.id).order_by(
                GlycanCombinationGlycanComposition.c.combination_id).all():
            if rel.combination_id != last_combination_id:
                if last_combination_id is not None and keep:
                    keepers.append(last_combination_id)
                last_combination_id = rel.combination_id
                keep = True
            if rel.glycan_id not in inclusion_filter:
                keep = False
        if keep:
            keepers.append(last_combination_id)
        return frozenset(keepers)

    def get_items_for_display(self, protein_id):
        with self._snapshots_lock:
            if protein_id in self._snapshots:
                snapshot = self._snapshots[protein_id]
                if not snapshot.is_valid(self.score_threshold, self.monosaccharide_bounds):
                    print("Previous Snapshot Invalid, Rebuilding")
                    snapshot = self._build_protein_snap_shot(protein_id)
            else:
                print("New Protein, Building Snapshot")
                snapshot = self._build_protein_snap_shot(protein_id)
            self._snapshots[protein_id] = snapshot
        return snapshot

    def get_glycopeptide(self, glycopeptide_id):
        return self.convert_glycopeptide(self.session.query(Glycopeptide).get(glycopeptide_id))

    def convert_glycopeptide(self, identified_glycopeptide):
        if identified_glycopeptide.id in self._converted_cache:
            return self._converted_cache[identified_glycopeptide.id]
        else:
            inst = identified_glycopeptide.convert()
            self._converted_cache[identified_glycopeptide.id] = inst
            return inst

    def _build_protein_snap_shot(self, protein_id):
        print("Loading Glycopeptides")
        gps = self.session.query(
            IdentifiedGlycopeptide,
            Glycopeptide.glycan_combination_id).join(IdentifiedGlycopeptide.structure).filter(
            IdentifiedGlycopeptide.analysis_id == self.analysis_id,
            Glycopeptide.protein_id == protein_id,
            IdentifiedGlycopeptide.ms2_score > self.score_threshold).all()

        print("Retrieving Valid Glycan Combinations")
        valid_glycan_combinations = self.filter_glycan_combinations()

        print("Filtering Glycopeptides by Glycans")
        keepers = []
        for gp, glycan_combination_id in gps:
            if glycan_combination_id in valid_glycan_combinations:
                keepers.append(gp)

        print("Converting Kept Glycopeptides")
        keepers = [self.convert_glycopeptide(gp) for gp in keepers]

        print("Snapshot Complete")
        snapshot = GlycopeptideSnapShot(protein_id, self.score_threshold, self.monosaccharide_bounds, keepers)
        return snapshot

    def update_connection(self, session):
        self.session = session
        self._resolve_sources()

    def update_threshold(self, score_threshold, monosaccharide_bounds):
        last_threshold = self.score_threshold
        self.score_threshold = score_threshold
        if last_threshold != score_threshold:
            print("Reindexing Proteins")
            self._build_protein_index()
        self.monosaccharide_bounds = monosaccharide_bounds

    def paginate(self, protein_id, page, per_page=25):
        return self.get_items_for_display(protein_id).paginate(page, per_page)


def get_view(analysis_id):
    if analysis_id in VIEW_CACHE:
        view = VIEW_CACHE[analysis_id]
    else:
        view = GlycopeptideAnalysisView(g.manager.session, analysis_id)
        VIEW_CACHE[analysis_id] = view
    view.update_connection(g.manager.session)
    return view


@app.route("/view_glycopeptide_lcmsms_analysis/<int:analysis_id>")
def index(analysis_id):
    view = get_view(analysis_id)
    args, state = request_arguments_and_context()
    print("Loading Index")
    view.update_threshold(state.settings['minimum_ms2_score'], state.monosaccharide_filters)
    return render_template(
        "view_glycopeptide_search/overview.templ", analysis=view.analysis,
        protein_table=view.protein_index)


@app.route("/view_glycopeptide_lcmsms_analysis/<int:analysis_id>/<int:protein_id>/overview", methods=['POST'])
def protein_view(analysis_id, protein_id):
    view = get_view(analysis_id)
    args, state = request_arguments_and_context()
    view.update_threshold(state.settings['minimum_ms2_score'], state.monosaccharide_filters)
    snapshot = view.get_items_for_display(protein_id)
    glycoprotein = snapshot.get_glycoprotein(g.manager.session)
    return render_template(
        "view_glycopeptide_search/components/protein_view.templ",
        glycoprotein=glycoprotein)


@app.route("/view_glycopeptide_lcmsms_analysis/<int:analysis_id>/<int:protein_id>/page/<int:page>", methods=['POST'])
def page(analysis_id, protein_id, page):
    view = get_view(analysis_id)
    snapshot = view.get_items_for_display(protein_id)
    paginator = snapshot.paginate(page, 25)
    return render_template("view_glycopeptide_search/components/glycopeptide_match_table.templ", paginator=paginator)


@app.route("/view_glycopeptide_lcmsms_analysis/<int:analysis_id>/<int:protein_id>/plot_glycoforms", methods=['POST'])
def plot_glycoforms(analysis_id, protein_id):
    view = get_view(analysis_id)
    snapshot = view.get_items_for_display(protein_id)
    svg = snapshot.plot_glycoforms(g.manager.session)
    return svg


@app.route("/view_glycopeptide_lcmsms_analysis/<int:analysis_id>/<int:protein_id>/site_specific_glycosylation",
           methods=['POST'])
def site_specific_glycosylation(analysis_id, protein_id):
    view = get_view(analysis_id)
    snapshot = view.get_items_for_display(protein_id)
    axes_map = snapshot.site_specific_glycosylation(g.manager.session)
    glycoprotein = snapshot.get_glycoprotein(g.manager.session)
    return render_template(
        "/view_glycopeptide_search/components/site_specific_glycosylation.templ",
        axes_map=axes_map, glycoprotein=glycoprotein)


@app.route(
    "/view_glycopeptide_lcmsms_analysis/<int:analysis_id>/<int:protein_id>/details_for/<int:glycopeptide_id>",
    methods=['POST'])
def glycopeptide_detail(analysis_id, protein_id, glycopeptide_id):
    view = get_view(analysis_id)
    snapshot = view.get_items_for_display(protein_id)
    try:
        gp = snapshot[glycopeptide_id]
    except:
        gp = view.get_glycopeptide(glycopeptide_id)
    spectrum_match_ref = max(gp.spectrum_matches, key=lambda x: x.score)

    session = g.manager.session
    scan = session.query(MSScan).filter(
        MSScan.scan_id == spectrum_match_ref.scan.id,
        MSScan.sample_run_id == view.analysis.sample_run_id).first().convert()
    match = BinomialSpectrumMatcher.evaluate(scan, gp.structure)

    ax = figax()
    SmoothingChromatogramArtist([gp], ax=ax).draw(label_function=lambda *a, **k: "", legend=False)

    spectrum_plot = match.annotate(ax=figax(), pretty=True)
    spectrum_plot.set_title("Annotated Scan\n\"%s\"\n" % (scan.id,), fontsize=18)
    spectrum_plot.set_ylabel(spectrum_plot.get_ylabel(), fontsize=16)
    spectrum_plot.set_xlabel(spectrum_plot.get_xlabel(), fontsize=16)

    sequence_logo_plot = glycopeptide_match_logo(match, ax=figax())

    return render_template(
        "/view_glycopeptide_search/components/glycopeptide_detail.templ",
        glycopeptide=gp,
        match=match,
        chromatogram_plot=report.svg_plot(ax, bbox_inches='tight', height=3, width=7),
        spectrum_plot=report.svg_plot(spectrum_plot, bbox_inches='tight', height=3, width=10),
        sequence_logo_plot=report.svg_plot(sequence_logo_plot, bbox_inches='tight', height=2, width=7),
    )


@app.route("/view_glycopeptide_lcmsms_analysis/<int:analysis_id>/to-csv")
def to_csv(analysis_id):
    view = get_view(analysis_id)

    protein_name_resolver = {entry['protein_id']: entry['protein_name'] for entry in view.protein_index}

    file_name = "%s-glycopeptides.csv" % (view.analysis.name)
    path = g.manager.get_temp_path(file_name)

    gen = (
        gp for protein_id in protein_name_resolver for gp in
        view.get_items_for_display(protein_id).members)

    GlycopeptideLCMSMSAnalysisCSVSerializer(
        open(path, 'wb'), gen,
        protein_name_resolver).start()
    return jsonify(filename=file_name)
