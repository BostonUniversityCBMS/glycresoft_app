from flask import Response, g, request, render_template, abort
from .service_module import register_service
from . import view_glycan_lcms_analysis, view_glycopeptide_lcmsms_analysis


from glycan_profiling.serialize import AnalysisTypeEnum


app = view_analysis = register_service("view_analysis", __name__)


@app.route("/view_analysis/<uuid>", methods=['POST'])
def view_analysis_dispatch(uuid):
    analysis = g.manager.analysis_manager.get(uuid)
    if analysis.analysis_type == AnalysisTypeEnum.glycan_lc_ms:
        return view_glycan_lcms_analysis.index(uuid)
    elif analysis.analysis_type == AnalysisTypeEnum.glycopeptide_lc_msms:
        return view_glycopeptide_lcmsms_analysis.index(uuid)
    else:
        return abort(404)
