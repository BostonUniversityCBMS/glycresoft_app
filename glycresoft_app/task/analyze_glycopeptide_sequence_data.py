from click import Abort

from glycresoft_app.utils import json_serializer
from .task_process import Task, Message

from glycan_profiling.serialize import (
    DatabaseBoundOperation, GlycopeptideHypothesis,
    SampleRun)

from glycan_profiling.profiler import (
    GlycopeptideLCMSMSAnalyzer)

from glycan_profiling.cli.validators import (
    validate_analysis_name)

from glycan_profiling.scoring import chromatogram_solution, shape_fitter


def get_by_name_or_id(session, model_type, name_or_id):
    try:
        object_id = int(name_or_id)
        inst = session.query(model_type).get(object_id)
        if inst is None:
            raise ValueError("No instance of type %s with id %r" %
                             (model_type, name_or_id))
        return inst
    except ValueError:
        inst = session.query(model_type).filter(
            model_type.name == name_or_id).one()
        return inst


def analyze_glycopeptide_sequences(database_connection, sample_identifier, hypothesis_identifier,
                                   analysis_name, grouping_error_tolerance=1.5e-5, mass_error_tolerance=1e-5,
                                   msn_mass_error_tolerance=2e-5, psm_fdr_threshold=0.05, peak_shape_scoring_model=None,
                                   channel=None, **kwargs):
    if peak_shape_scoring_model is None:
        peak_shape_scoring_model = chromatogram_solution.ChromatogramScorer(
            shape_fitter_type=shape_fitter.AdaptiveMultimodalChromatogramShapeFitter)
    database_connection = DatabaseBoundOperation(database_connection)
    try:
        sample_run = get_by_name_or_id(
            database_connection, SampleRun, sample_identifier)
    except:
        channel.send(Message("Could not locate sample %r" % sample_identifier, "error"))
        return
    try:
        hypothesis = get_by_name_or_id(
            database_connection, GlycopeptideHypothesis, hypothesis_identifier)
    except:
        channel.send(Message("Could not locate hypothesis %r" % hypothesis_identifier, "error"))
        return

    if analysis_name is None:
        analysis_name = "%s @ %s" % (sample_run.name, hypothesis.name)
    analysis_name = validate_analysis_name(None, database_connection.session, analysis_name)

    try:
        analyzer = GlycopeptideLCMSMSAnalyzer(
            database_connection._original_connection, hypothesis.id, sample_run.id,
            analysis_name, grouping_error_tolerance=grouping_error_tolerance, mass_error_tolerance=mass_error_tolerance,
            msn_mass_error_tolerance=msn_mass_error_tolerance, psm_fdr_threshold=psm_fdr_threshold,
            peak_shape_scoring_model=peak_shape_scoring_model)
        proc = analyzer.start()
        analysis = analyzer.analysis
        channel.send(Message(json_serializer.handle_analysis(analysis), 'new-analysis'))
    except:
        channel.send(Message.traceback())


class AnalyzeGlycopeptideSequenceTask(Task):
    count = 0

    def __init__(self, database_connection, sample_identifier, hypothesis_identifier,
                 analysis_name, grouping_error_tolerance=1.5e-5, mass_error_tolerance=1e-5,
                 msn_mass_error_tolerance=2e-5, psm_fdr_threshold=0.05, peak_shape_scoring_model=None,
                 callback=lambda: 0, **kwargs):
        args = (database_connection, sample_identifier, hypothesis_identifier,
                analysis_name, grouping_error_tolerance, mass_error_tolerance,
                msn_mass_error_tolerance, psm_fdr_threshold, peak_shape_scoring_model)
        if analysis_name is None:
            name_part = kwargs.pop("job_name_part", self.count)
            self.count += 1
        else:
            name_part = analysis_name
        job_name = "Analyze Glycopeptide Sequence %s" % (name_part,)
        kwargs.setdefault('name', job_name)
        Task.__init__(self, analyze_glycopeptide_sequences, args, callback, **kwargs)
