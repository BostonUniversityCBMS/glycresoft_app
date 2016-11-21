import functools
from werkzeug import secure_filename
from flask import Response, g, request, render_template, redirect, abort, current_app
from .service_module import register_service

from ..utils.state_transfer import request_arguments_and_context
from ..task.preprocess_mzml import PreprocessMSTask
from ..report import svg_plot

from glycan_profiling.serialize import DatabaseBoundOperation, DatabaseScanDeserializer
from glycan_profiling.plotting import AbundantLabeler, SmoothingChromatogramArtist
from glycan_profiling.trace import ChromatogramExtractor


app = sample_management = register_service("sample_management", __name__)


@sample_management.route("/add_sample", methods=["POST"])
def post_add_sample():
    """Handle an uploaded sample file

    Returns
    -------
    TYPE : Description
    """
    sample_name = request.values['sample-name']
    if sample_name == "":
        sample_name = request.files['observed-ions-file'].filename
    if sample_name == "":
        current_app.logger.info("No sample name could be extracted. %r", request.values)
        return abort(400)
    secure_name = secure_filename(sample_name)
    path = g.manager.get_temp_path(secure_name)
    request.files['observed-ions-file'].save(path)
    # dest = g.manager.get_sample_path(sample_name)

    # Construct the task with a callback to add the processed sample
    # to the set of project samples

    start_time = float(request.values['start-time'])
    end_time = float(request.values['end-time'])

    prefab_averagine = request.values['ms1-averagine']
    prefab_msn_averagine = request.values['msn-averagine']

    custom_ms1_averagine_formula = request.values['ms1-averagine-custom']
    custom_msn_averagine_formula = request.values['msn-averagine-custom']

    if custom_ms1_averagine_formula:
        averagine = custom_ms1_averagine_formula
    else:
        averagine = prefab_averagine

    if custom_msn_averagine_formula:
        msn_averagine = custom_msn_averagine_formula
    else:
        msn_averagine = prefab_msn_averagine

    ms1_score_threshold = float(request.values['ms1-minimum-isotopic-score'])
    msn_score_threshold = float(request.values['msn-minimum-isotopic-score'])

    missed_peaks = int(request.values['missed-peaks'])
    maximum_charge_state = int(request.values['maximum-charge-state'])

    task = PreprocessMSTask(
        path, g.manager.connection_bridge,
        averagine, start_time, end_time, maximum_charge_state,
        sample_name, msn_averagine, ms1_score_threshold,
        msn_score_threshold, missed_peaks, callback=lambda: 0)

    g.manager.add_task(task)
    return Response("Task Scheduled")


@sample_management.route("/add_sample")
def add_sample():
    return render_template("add_sample_form.templ")


@sample_management.route("/draw_raw_chromatograms/<int:sample_run_id>")
def draw_raw_chromatograms(sample_run_id):
    d = DatabaseScanDeserializer(g.manager.connection_bridge, sample_run_id=sample_run_id)
    ex = ChromatogramExtractor(d)
    chroma = ex.run()
    a = SmoothingChromatogramArtist(chroma, colorizer=lambda *a, **k: 'black')
    a.draw(label_function=lambda *a, **kw: "")
    rt, intens = ex.total_ion_chromatogram.as_arrays()
    a.draw_generic_chromatogram(
        "TIC", rt, intens, 'blue')
    a.ax.set_ylim(0, max(intens) * 1.1)
    axis = a.ax
    return svg_plot(axis)
