import logging
from flask import request, g, render_template, Response, jsonify

from glycan_profiling.serialize import (
    GlycanHypothesis, GlycopeptideHypothesis, Protein,
    GlycanComposition, Glycopeptide, func, DatabaseBoundOperation,
    object_session)

from glycan_profiling.output.csv_format import ImportableGlycanHypothesisCSVSerializer

from glycresoft_app.utils.pagination import paginate
from glycresoft_app.utils.state_transfer import request_arguments_and_context
from glycresoft_app.task import Message

from .service_module import register_service


app = view_hypothesis = register_service("view_hypothesis", __name__)


def _locate_hypothesis(uuid):
    try:
        hypothesis_record = g.manager.hypothesis_manager.get(uuid)
        return hypothesis_record
    except Exception:
        return None


def get_glycan_hypothesis(uuid):
    record = g.manager.hypothesis_manager.get(uuid)
    handle = DatabaseBoundOperation(record.path)
    hypothesis = handle.query(GlycanHypothesis).filter(
        GlycanHypothesis.uuid == record.uuid).first()
    return hypothesis


def get_glycopeptide_hypothesis(uuid):
    record = g.manager.hypothesis_manager.get(uuid)
    handle = DatabaseBoundOperation(record.path)
    hypothesis = handle.query(GlycopeptideHypothesis).filter(
        GlycopeptideHypothesis.uuid == record.uuid).first()
    return hypothesis


@app.route("/view_hypothesis/<uuid>", methods=["POST"])
def view_hypothesis_dispatch(uuid):
    try:
        arguments, state = request_arguments_and_context()
        record = _locate_hypothesis(uuid)
        handle = DatabaseBoundOperation(record.path)
        hypothesis = handle.query(GlycanHypothesis).filter(
            GlycanHypothesis.uuid == record.uuid).first()

        if hypothesis is not None:
            return handle_glycan_hypothesis(hypothesis)

        hypothesis = handle.query(GlycopeptideHypothesis).filter(
            GlycopeptideHypothesis.uuid == record.uuid).first()
        if hypothesis is not None:
            return handle_glycopeptide_hypothesis(hypothesis)

        return Response("<h2>%s</h2>" % record.name)
    except Exception, e:
        logging.exception("An exception occurred for %r",
                          request.get_json(), exc_info=e)
    return Response("<h2>No display method is implemented for %s </h2>" % request.get_json())


@app.route("/view_hypothesis/<uuid>/mass_search", methods=["POST"])
def mass_search_dispatch(uuid):
    try:
        arguments, state = request_arguments_and_context()
        record = _locate_hypothesis(uuid)
        handle = DatabaseBoundOperation(record.path)
        hypothesis = handle.query(GlycanHypothesis).filter(
            GlycanHypothesis.uuid == record.uuid).first()

        if hypothesis is not None:
            return search_glycan_hypothesis(hypothesis.uuid, arguments['mass'], arguments['tolerance'])

        hypothesis = handle.query(GlycopeptideHypothesis).filter(
            GlycopeptideHypothesis.uuid == record.uuid).first()
        if hypothesis is not None:
            return search_glycopeptide_hypothesis(hypothesis.uuid, arguments['mass'], arguments['tolerance'])

        return jsonify(*[])
    except Exception, e:
        logging.exception("An exception occurred for %r",
                          request.get_json(), exc_info=e)
        return jsonify(*[])


def handle_glycan_hypothesis(hypothesis):
    response = render_template("view_glycan_hypothesis/container.templ", hypothesis=hypothesis)
    object_session(hypothesis).close()
    return response


@app.route("/view_glycan_composition_hypothesis/<uuid>/", methods=["POST"])
def view_glycan_composition_hypothesis(uuid):
    hypothesis = get_glycan_hypothesis(uuid)
    response = render_template("view_glycan_hypothesis/container.templ", hypothesis=hypothesis)
    object_session(hypothesis).close()
    return response


@app.route("/view_glycan_composition_hypothesis/<uuid>/<int:page>", methods=["POST"])
def view_glycan_composition_hypothesis_table(uuid, page=1):
    page_size = 50
    hypothesis = get_glycan_hypothesis(uuid)
    hypothesis_id = hypothesis.id

    def filter_context(q):
        return q.filter_by(
            hypothesis_id=hypothesis_id)
    session = object_session(hypothesis)
    paginator = paginate(filter_context(session.query(GlycanComposition).filter(
        GlycanComposition.hypothesis_id == hypothesis_id)), page, page_size)
    response = render_template(
        "view_glycan_hypothesis/display_table.templ",
        paginator=paginator, base_index=(page - 1) * page_size)
    session.close()
    return response


@app.route("/view_glycan_composition_hypothesis/<uuid>/download-text")
def export_glycan_composition_hypothesis_as_text(uuid):
    hypothesis = get_glycan_hypothesis(uuid)
    entity_iterable = hypothesis.glycans
    g.add_message(Message("Building Export", "update"))
    file_name = "%s-glycan-compositions.txt" % (hypothesis.name)
    path = g.manager.get_temp_path(file_name)
    with open(path, 'wb') as handle:
        ImportableGlycanHypothesisCSVSerializer(handle, entity_iterable).start()
    file_names = [(file_name)]
    return jsonify(status='success', filenames=file_names)


def protein_index(session, hypothesis_id):
    theoretical_counts = session.query(Protein.name, Protein.id, func.count(Glycopeptide.id)).join(
        Glycopeptide).group_by(Protein.id).filter(
        Protein.hypothesis_id == hypothesis_id).all()

    listing = []
    for protein_name, protein_id, glycopeptide_count in theoretical_counts:
        entry = {
            "protein_name": protein_name,
            "protein_id": protein_id,
            "theoretical_count": glycopeptide_count
        }
        listing.append(entry)
    protein_index = sorted(listing, key=lambda x: x["protein_name"])
    for protein_entry in protein_index:
        protein_entry['protein'] = session.query(Protein).get(protein_entry["protein_id"])
    return protein_index


def handle_glycopeptide_hypothesis(hypothesis):
    session = object_session(hypothesis)
    protein_table = protein_index(session, hypothesis.id)
    response = render_template("view_glycopeptide_hypothesis/container.templ",
                               hypothesis=hypothesis, protein_table=protein_table)
    session.close()
    return response


@app.route("/view_glycopeptide_hypothesis/<uuid>/<int:protein_id>/view", methods=['POST'])
def view_protein(uuid, protein_id):
    hypothesis = get_glycopeptide_hypothesis(uuid)
    session = object_session(hypothesis)
    protein = session.query(Protein).get(protein_id)
    response = render_template("view_glycopeptide_hypothesis/components/protein_view.templ", protein=protein)
    session.close()
    return response


@app.route("/view_glycopeptide_hypothesis/<uuid>/<int:protein_id>/page/<int:page>", methods=['POST'])
def paginate_theoretical_glycopeptides(uuid, protein_id, page, per_page=50):
    hypothesis = get_glycopeptide_hypothesis(uuid)
    session = object_session(hypothesis)
    paginator = paginate(session.query(Glycopeptide).filter(
        Glycopeptide.protein_id == protein_id), page, per_page)
    base_index = (page - 1) * per_page
    response = render_template(
        "view_glycopeptide_hypothesis/components/display_table.templ",
        paginator=paginator, base_index=base_index)
    session.close()
    return response


def search_glycopeptide_hypothesis(uuid, mass, ppm_tolerance):
    hypothesis = get_glycopeptide_hypothesis(uuid)
    session = object_session(hypothesis)

    lo = mass - (mass * ppm_tolerance)
    hi = mass + (mass * ppm_tolerance)

    hits = session.query(Glycopeptide).filter(
        Glycopeptide.hypothesis_id == hypothesis.id,
        Glycopeptide.calculated_mass.between(lo, hi)).all()
    converted = [
        {"string": hit.glycopeptide_sequence, "mass": hit.calculated_mass,
         "error": (mass - hit.calculated_mass) / hit.calculated_mass} for hit in hits
    ]
    session.close()
    if len(converted) == 1:
        return jsonify(converted)
    return jsonify(*converted)


def search_glycan_hypothesis(uuid, mass, ppm_tolerance):
    hypothesis = get_glycan_hypothesis(uuid)
    session = object_session(hypothesis)
    lo = mass - (mass * ppm_tolerance)
    hi = mass + (mass * ppm_tolerance)
    hits = session.query(GlycanComposition).filter(
        GlycanComposition.hypothesis_id == hypothesis.id,
        GlycanComposition.calculated_mass.between(lo, hi)).all()
    converted = [
        {"string": hit.composition, "mass": hit.calculated_mass,
         "error": (mass - hit.calculated_mass) / hit.calculated_mass} for hit in hits
    ]
    session.close()
    if len(converted) == 1:
        return jsonify(converted)
    else:
        return jsonify(*converted)
