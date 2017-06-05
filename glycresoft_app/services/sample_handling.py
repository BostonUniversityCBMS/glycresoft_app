import re
import os

from uuid import uuid4
from multiprocessing import cpu_count

from werkzeug import secure_filename
from flask import Response, g, request, render_template, redirect, abort, current_app
from .service_module import register_service
from .form_cleaners import make_unique_name, touch_file

from glycresoft_app.task.preprocess_mzml import PreprocessMSTask


app = sample_management = register_service("sample_management", __name__)


@sample_management.route("/add_sample", methods=["POST"])
def post_add_sample():
    """Handle an uploaded sample file

    Returns
    -------
    Response
    """
    sample_name = request.values['sample-name']
    if sample_name == "":
        sample_name = request.files['observed-ions-file'].filename
    # If no sample name could be constructed at this point
    # and we are not running a native client, stop now.
    if sample_name == "" and not g.has_native_client:
        current_app.logger.info("No sample name could be extracted. %r", request.values)
        return abort(400)

    # If we are running in the native client, then the program
    # have different information about where to read file information
    # from. Normal browsers cannot access the full path of files being
    # uploaded, but Electron can. It will intercept the file upload and
    # instead send its native path. Since the native client is running
    # on the local file system, we can directly read from that path
    # without needing to first copy the sample file to application server's
    # file system.
    if g.has_native_client:
        native_path = request.values.get("observed-ions-file-path")
        if sample_name == "":
            sample_name = os.path.splitext(os.path.basename(native_path))[0]
        if sample_name == "":
            current_app.logger.info("No sample name could be extracted. %r", request.values)
            abort(400)
        path = native_path
        sample_name = g.manager.make_unique_sample_name(
            sample_name)
        secure_name = secure_filename(sample_name)
        current_app.logger.info(
            "Preparing to run with native path: %r, %r, %r", path, sample_name, secure_name)
    else:
        file_name = request.files['observed-ions-file'].filename
        sample_name = g.manager.make_unique_sample_name(
            sample_name)
        secure_name = secure_filename(file_name)
        path = g.manager.get_temp_path(secure_name)
        request.files['observed-ions-file'].save(path)

    storage_path = g.manager.get_sample_path(
        re.sub(r"[\s\(\)]", "_", secure_name) + '-%s.mzML')

    storage_path = make_unique_name(storage_path)
    touch_file(storage_path)

    # Construct the task with a callback to add the processed sample
    # to the set of project samples

    start_time = float(request.values['start-time'])
    end_time = float(request.values['end-time'])

    extract_only_tandem_envelopes = bool(request.values.get("msms-features-only", False))

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
    msn_missed_peaks = int(request.values['msn-missed-peaks'])
    maximum_charge_state = int(request.values['maximum-charge-state'])

    ms1_background_reduction = float(request.values.get(
        'ms1-background-reduction', 5.))
    msn_background_reduction = float(request.values.get(
        'msn-background-reduction', 0.))

    n_workers = g.manager.configuration.get("preprocessor_worker_count", 6)
    if cpu_count() < n_workers:
        n_workers = cpu_count()

    task = PreprocessMSTask(
        path, g.manager.connection_bridge,
        averagine, start_time, end_time, maximum_charge_state,
        sample_name, msn_averagine, ms1_score_threshold,
        msn_score_threshold, missed_peaks, msn_missed_peaks, n_processes=n_workers,
        storage_path=storage_path, extract_only_tandem_envelopes=extract_only_tandem_envelopes,
        ms1_background_reduction=ms1_background_reduction,
        msn_background_reduction=msn_background_reduction,
        callback=lambda: 0)

    g.add_task(task)
    return Response("Task Scheduled")


@sample_management.route("/add_sample")
def add_sample():
    return render_template("add_sample_form.templ")
