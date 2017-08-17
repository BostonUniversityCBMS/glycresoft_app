import os
from click import Abort

from glycresoft_app.project import analysis as project_analysis
from .task_process import Task, Message

from glycan_profiling.serialize import (
    DatabaseBoundOperation, GlycanHypothesis,
    SampleRun)

from glycan_profiling.profiler import (
    MzMLGlycanChromatogramAnalyzer)

from glycan_profiling.models import GeneralScorer

from glycan_profiling.cli.validators import (
    validate_analysis_name,
    validate_adduct)


from ms_deisotope.output.mzml import ProcessedMzMLDeserializer


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


def analyze_glycan_composition(database_connection, sample_path, hypothesis_identifier,
                               output_path, analysis_name, adducts, grouping_error_tolerance=1.5e-5,
                               mass_error_tolerance=1e-5, scoring_model=None,
                               minimum_mass=500.,
                               channel=None, **kwargs):
    if scoring_model is None:
        scoring_model = GeneralScorer

    database_connection = DatabaseBoundOperation(database_connection)

    if not os.path.exists(sample_path):
        channel.send(Message("Could not locate sample %r" % sample_path, "error"))
        return

    reader = ProcessedMzMLDeserializer(sample_path, use_index=False)
    sample_run = reader.sample_run

    try:
        hypothesis = get_by_name_or_id(
            database_connection, GlycanHypothesis, hypothesis_identifier)
    except Exception:
        channel.send(Message("Could not locate hypothesis %r" % hypothesis_identifier, "error"))
        return

    if analysis_name is None:
        analysis_name = "%s @ %s" % (sample_run.name, hypothesis.name)
    analysis_name = validate_analysis_name(None, database_connection.session, analysis_name)

    try:
        adduct_out = []
        for adduct, multiplicity in adducts:
            adduct_out.append(validate_adduct(adduct, multiplicity))
        expanded = []
        expanded = MzMLGlycanChromatogramAnalyzer.expand_adducts(dict(adduct_out))
        adducts = expanded
    except Abort:
        channel.send(Message.traceback())
        return

    adducts = expanded

    try:
        analyzer = MzMLGlycanChromatogramAnalyzer(
            database_connection._original_connection, hypothesis.id,
            sample_path=sample_path,
            output_path=output_path,
            adducts=adducts,
            mass_error_tolerance=mass_error_tolerance,
            grouping_error_tolerance=grouping_error_tolerance,
            scoring_model=scoring_model,
            analysis_name=analysis_name,
            minimum_mass=minimum_mass)
        analyzer.start()
        analysis = analyzer.analysis
        record = project_analysis.AnalysisRecord(
            name=analysis.name, id=analysis.id, uuid=analysis.uuid, path=output_path,
            analysis_type=analysis.analysis_type,
            hypothesis_uuid=analysis.hypothesis.uuid,
            hypothesis_name=analysis.hypothesis.name,
            sample_name=analysis.parameters['sample_name'],
            user_id=channel.user.id)
        channel.send(Message(record.to_json(), 'new-analysis'))
    except Exception:
        channel.send(Message.traceback())
        channel.abort("An error occurred during analysis.")


class AnalyzeGlycanCompositionTask(Task):
    count = 0

    def __init__(self, database_connection, sample_path, hypothesis_identifier,
                 output_path, analysis_name, adducts, grouping_error_tolerance=1.5e-5,
                 mass_error_tolerance=1e-5, scoring_model=None,
                 minimum_mass=500.,
                 callback=lambda: 0, **kwargs):
        args = (database_connection, sample_path, hypothesis_identifier,
                output_path, analysis_name, adducts, grouping_error_tolerance,
                mass_error_tolerance, scoring_model,
                minimum_mass)
        if analysis_name is None:
            name_part = kwargs.pop("job_name_part", self.count)
            self.count += 1
        else:
            name_part = analysis_name
        job_name = "Analyze Glycan Composition %s" % (name_part,)
        kwargs.setdefault('name', job_name)
        Task.__init__(self, analyze_glycan_composition, args, callback, **kwargs)
