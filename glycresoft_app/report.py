import os
import urllib

from glycopeptidepy import PeptideSequence
from glycopeptidepy.utils.collectiontools import groupby
from glypy.composition.glycan_composition import GlycanComposition
from ms_deisotope import mass_charge_ratio

from glycan_profiling.symbolic_expression import GlycanSymbolContext
from glycan_profiling.scoring.chromatogram_solution import logit

from jinja2 import Environment, PackageLoader, FileSystemLoader, escape


from io import BytesIO

from lxml import etree

from matplotlib import rcParams as mpl_params
from matplotlib import pyplot as plt
from matplotlib.axes import Axes

from glycan_profiling.plotting import colors


mpl_params.update({
    'figure.facecolor': 'white',
    'figure.edgecolor': 'white',
    'font.size': 10,
    'savefig.dpi': 72,
    'figure.subplot.bottom': .125})


def png_plot(figure, **kwargs):
    data_buffer = render_plot(figure, format='png', **kwargs)
    return "<img src='data:image/png;base64,%s'>" % urllib.quote(data_buffer.getvalue().encode("base64"))


def svg_plot(figure, svg_width=None, xml_transform=None, **kwargs):
    data_buffer = render_plot(figure, format='svg', **kwargs)
    if svg_width is not None or xml_transform is not None:
        root = etree.fromstring(data_buffer.getvalue())
        if svg_width is not None:
            root.attrib["width"] = svg_width
        if xml_transform is not None:
            root = xml_transform(root)
        return etree.tostring(root)
    else:
        return data_buffer.getvalue()


def svguri_plot(figure, **kwargs):
    svg_string = svg_plot(figure, **kwargs)
    return "<img src='data:image/svg+xml;utf-8,%s'>" % urllib.quote(svg_string)


def render_plot(figure, **kwargs):
    if isinstance(figure, Axes):
        figure = figure.get_figure()
    if "height" in kwargs:
        figure.set_figheight(kwargs["height"])
    if "width" in kwargs:
        figure.set_figwidth(kwargs['width'])
    if kwargs.get("bbox_inches") != 'tight' or kwargs.get("patchless"):
        figure.patch.set_alpha(0)
        figure.axes[0].patch.set_alpha(0)
    data_buffer = BytesIO()
    figure.savefig(data_buffer, **kwargs)
    plt.close(figure)
    return data_buffer


def rgbpack(color):
    return "rgba(%d,%d,%d,0.5)" % tuple(i * 255 for i in color)


def sort_peak_match_pairs(pairs):
    series = groupby(pairs, key_fn=lambda x: x.fragment.series)
    segments = []
    for key in sorted(series):
        segment = series[key]
        if hasattr(segment[0].fragment, "position"):
            segment.sort(key=lambda x: x.fragment.position)
        else:
            segment.sort(key=lambda x: x.fragment.mass)
        segments.extend(segment)
    return segments


def glycopeptide_string(sequence, long=False, include_glycan=True):
    sequence = PeptideSequence(str(sequence))
    parts = []
    template = "(<span class='modification-chip'"\
        " style='background-color:%s;padding-left:1px;padding-right:2px;border-radius:2px;'"\
        " title='%s' data-modification='%s'>%s</span>)"

    n_term_template = template.replace("(", "").replace(")", "") + '-'
    c_term_template = "-" + (template.replace("(", "").replace(")", ""))

    def render(mod, template=template):
        color = colors.get_color(str(mod))
        letter = escape(mod.name if long else mod.name[0])
        name = escape(mod.name)
        parts.append(template % (rgbpack(color), name, name, letter))

    if sequence.n_term != "H":
        render(sequence.n_term, n_term_template)
    for res, mods in sequence:
        parts.append(res.symbol)
        for mod in mods:
            render(mod)
    if sequence.c_term != "OH":
        render(sequence.c_term, c_term_template)
    parts.append((
        ' ' + glycan_composition_string(str(sequence.glycan)) if sequence.glycan is not None else "")
        if include_glycan else "")
    return ''.join(parts)


def formula(composition):
    return ''.join("<b>%s</b><sub>%d</sub>" % (k, v) for k, v in sorted(composition.items()))


def glycan_composition_string(composition):
    try:
        composition = GlycanComposition.parse(
            GlycanSymbolContext(
                GlycanComposition.parse(
                    composition)).serialize())
    except ValueError:
        return "<code>%s</code>" % composition

    parts = []
    template = ("<span class='monosaccharide-composition-name'"
                "style='background-color:%s'>"
                "%s&nbsp;%d</span>")
    for k, v in sorted(composition.items(), key=lambda x: x[0].mass()):
        name = str(k)
        color = colors.get_color(str(name))
        parts.append(template % (rgbpack(color), name, v))
    reduced = composition.reducing_end
    if reduced:
        reducing_end_template = (
            "<span class='monosaccharide-composition-name'"
            "style='background-color:%s;padding:2px;border-radius:2px;'>"
            "%s</span>")
        name = formula(reduced.composition)
        color = colors.get_color(str(name))
        parts.append(reducing_end_template % (rgbpack(color), name))

    return ' '.join(parts)


def highlight_sequence_site(amino_acid_sequence, site_list, site_type_list):
    if isinstance(site_type_list, basestring):
        site_type_list = [site_type_list for i in site_list]
    sequence = list(amino_acid_sequence)
    for site, site_type in zip(site_list, site_type_list):
        sequence[site] = "<span class='{}'>{}</span>".format(site_type, sequence[site])
    return sequence


def n_per_row(sequence, n=60):
    row_buffer = []
    i = 0
    while i < len(sequence):
        row_buffer.append(
            ''.join(sequence[i:(i + n)])
        )
        i += n
    return '<br>'.join(row_buffer)


def prepare_environment(env=None):
    try:
        raise Exception()
        loader = PackageLoader("glycresoft_app", "html")
        loader.list_templates()
    except Exception:
        loader = FileSystemLoader(os.path.join(os.path.dirname(__file__), 'html'))
    if env is None:
        env = Environment(loader=loader)
    else:
        env.loader = loader
    env.fragment_cache = dict()
    env.filters["n_per_row"] = n_per_row
    env.filters['highlight_sequence_site'] = highlight_sequence_site
    env.filters['svg_plot'] = svg_plot
    env.filters['png_plot'] = png_plot
    env.filters['svguri_plot'] = svguri_plot
    env.filters['glycopeptide_string'] = glycopeptide_string
    env.filters['glycan_composition_string'] = glycan_composition_string
    env.filters["formula"] = formula
    env.filters["sort_peak_match_pairs"] = sort_peak_match_pairs
    env.filters["mass_charge_ratio"] = mass_charge_ratio
    env.filters["logit"] = logit
    return env
