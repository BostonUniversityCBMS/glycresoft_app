import os
from click import Abort

from glycresoft_app.utils import json_serializer
from .task_process import Task, Message

from glycan_profiling.serialize import (
    DatabaseBoundOperation, GlycanHypothesis,
    SampleRun)

from glycan_profiling.profiler import (
    GlycanChromatogramAnalyzer)

from glycan_profiling.models import GeneralScorer

from glycan_profiling.cli.validators import (
    validate_analysis_name,
    validate_adduct)


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


def analyze_glycan_composition(database_connection, sample_identifier, hypothesis_identifier,
                               analysis_name, adducts, grouping_error_tolerance=1.5e-5,
                               mass_error_tolerance=1e-5, scoring_model=None, network_sharing=None,
                               minimum_mass=500.,
                               channel=None, **kwargs):
    if scoring_model is None:
        scoring_model = GeneralScorer

    if network_sharing is None:
        network_sharing = 0.2

    database_connection = DatabaseBoundOperation(database_connection)

    try:
        sample_run = get_by_name_or_id(
            database_connection, SampleRun, sample_identifier)
    except:
        channel.send(Message("Could not locate sample %r" % sample_identifier, "error"))
        return
    try:
        hypothesis = get_by_name_or_id(
            database_connection, GlycanHypothesis, hypothesis_identifier)
    except:
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
        for adduct, mult in adduct_out:
            for i in range(1, mult + 1):
                expanded.append(adduct * i)
        adducts = expanded
    except Abort:
        channel.send(Message.traceback())
        return

    adducts = expanded

    try:
        analyzer = GlycanChromatogramAnalyzer(
            database_connection._original_connection, hypothesis.id,
            sample_run.id, adducts=adducts, mass_error_tolerance=mass_error_tolerance,
            grouping_error_tolerance=grouping_error_tolerance, scoring_model=scoring_model,
            analysis_name=analysis_name, network_sharing=network_sharing,
            minimum_mass=minimum_mass)
        proc = analyzer.start()
        analysis = analyzer.analysis
        channel.send(Message(json_serializer.handle_analysis(analysis), 'new-analysis'))
    except:
        channel.send(Message.traceback())


class AnalyzeGlycanCompositionTask(Task):
    count = 0

    def __init__(self, database_connection, sample_identifier, hypothesis_identifier,
                 analysis_name, adducts, grouping_error_tolerance=1.5e-5,
                 mass_error_tolerance=1e-5, scoring_model=None, network_sharing=None,
                 minimum_mass=500.,
                 callback=lambda: 0, **kwargs):
        args = (database_connection, sample_identifier, hypothesis_identifier,
                analysis_name, adducts, grouping_error_tolerance,
                mass_error_tolerance, scoring_model, network_sharing,
                minimum_mass)
        if analysis_name is None:
            name_part = kwargs.pop("job_name_part", self.count)
            self.count += 1
        else:
            name_part = analysis_name
        job_name = "Analyze Glycan Composition %s" % (name_part,)
        kwargs.setdefault('name', job_name)
        Task.__init__(self, analyze_glycan_composition, args, callback, **kwargs)
