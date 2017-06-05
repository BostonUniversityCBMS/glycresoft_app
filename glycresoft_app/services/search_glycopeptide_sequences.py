import re
from flask import Response, g, request, render_template
from werkzeug import secure_filename

from .form_cleaners import remove_empty_rows, intify, make_unique_name
from .service_module import register_service

from ..task.analyze_glycopeptide_sequence_data import AnalyzeGlycopeptideSequenceTask

app = search_glycopeptide_sequences = register_service("search_glycopeptide_sequences", __name__)


@app.route("/search_glycopeptide_sequences/run_search")
def run_search():
    return render_template(
        "glycopeptide_search/run_search.templ",
        manager=g.manager)


@app.route("/search_glycopeptide_sequences/run_search", methods=["POST"])
def run_search_post():
    data = request.values
    matching_tolerance = float(data.get("ms1-tolerance", 10))
    if matching_tolerance > 1e-4:
        matching_tolerance *= 1e-6

    grouping_tolerance = float(data.get("peak-grouping-tolerance", 15))
    if grouping_tolerance > 1e-4:
        grouping_tolerance *= 1e-6

    ms2_matching_tolerance = float(data.get("ms2-tolerance", 20))
    if ms2_matching_tolerance > 1e-4:
        ms2_matching_tolerance *= 1e-6

    psm_fdr_threshold = float(data.get("q-value-threshold", 0.05))

    hypothesis_uuid = (data.get("hypothesis_choice"))
    hypothesis_record = g.manager.hypothesis_manager.get(hypothesis_uuid)
    hypothesis_name = hypothesis_record.name

    sample_records = list(map(g.manager.sample_manager.get, data.getlist("samples")))

    minimum_oxonium_threshold = float(data.get("minimum-oxonium-threshold", 0.05))

    for sample_record in sample_records:
        sample_name = sample_record.name
        job_number = g.manager.get_next_job_number()
        name_prefix = "%s at %s (%d)" % (hypothesis_name, sample_name, job_number)
        cleaned_prefix = re.sub(r"[\s\(\)]", "_", name_prefix)
        name_template = g.manager.get_results_path(
            secure_filename(cleaned_prefix) + "_%s.analysis.db")
        storage_path = make_unique_name(name_template)

        task = AnalyzeGlycopeptideSequenceTask(
            hypothesis_record.path, sample_record.path, hypothesis_record.id,
            storage_path, name_prefix, grouping_error_tolerance=grouping_tolerance,
            mass_error_tolerance=matching_tolerance,
            msn_mass_error_tolerance=ms2_matching_tolerance, psm_fdr_threshold=psm_fdr_threshold,
            minimum_oxonium_threshold=minimum_oxonium_threshold,
            job_name_part=job_number)
        g.add_task(task)
    return Response("Tasks Scheduled")
