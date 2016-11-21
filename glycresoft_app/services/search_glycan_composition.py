from flask import Response, g, request, render_template

from .form_cleaners import remove_empty_rows, intify
from .service_module import register_service

from ..task.analyze_glycan_composition_data import AnalyzeGlycanCompositionTask


app = search_glycan_composition = register_service("search_glycan_composition", __name__)


@app.route("/search_glycan_composition/run_search")
def run_search():
    return render_template("glycan_search/run_search.templ", manager=g.manager)


@app.route("/search_glycan_composition/run_search", methods=["POST"])
def run_search_post():
    data = request.values
    mass_shift_data = list(zip(data.getlist('mass_shift_name'),
                               data.getlist('mass_shift_max_count')))
    mass_shift_data = mass_shift_data[:-1]
    mass_shift_data = [(a, int(b)) for a, b in mass_shift_data]

    matching_tolerance = float(data.get("mass-matching-tolerance", 10))
    if matching_tolerance > 1e-4:
        matching_tolerance *= 1e-6

    grouping_tolerance = float(data.get("peak-grouping-tolerance", 15))
    if grouping_tolerance > 1e-4:
        grouping_tolerance *= 1e-6

    hypothesis_id = int(data.get("hypothesis_choice"))
    sample_ids = list(map(int, data.getlist("samples")))

    network_sharing = float(data.get("network-sharing-coefficient", 0.2))
    minimum_mass = float(data.get("minimum-mass", 500.))

    for sample_id in sample_ids:
        task = AnalyzeGlycanCompositionTask(
            g.manager.connection_bridge, sample_id, hypothesis_id,
            None, mass_shift_data, grouping_tolerance,
            matching_tolerance, network_sharing=network_sharing,
            minimum_mass=minimum_mass,
            callback=lambda: 0,
            job_name_part=g.manager.get_next_job_number())
        g.manager.add_task(task)

    return Response("Tasks Scheduled")
