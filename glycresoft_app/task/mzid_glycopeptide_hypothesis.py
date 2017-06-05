from click import Abort

from glycan_profiling.cli.validators import (
    validate_glycan_source,
    validate_glycopeptide_hypothesis_name, validate_mzid_proteins)

from glycan_profiling.cli.build_db import _glycan_hypothesis_builders

from glycan_profiling.database.builder.glycopeptide.informed_glycopeptide import (
    MultipleProcessMzIdentMLGlycopeptideHypothesisSerializer)

from glycresoft_app.project import hypothesis as project_hypothesis
from .task_process import Task, Message


def mzid_glycopeptide(database_connection, mzid_file, name, occupied_glycosites, target_protein,
                      processes, glycan_source, glycan_source_type, glycan_source_identifier,
                      channel):
    context = None
    proteins = validate_mzid_proteins(
        context, mzid_file, target_protein, [])
    try:
        validate_glycan_source(context, database_connection,
                               glycan_source, glycan_source_type,
                               glycan_source_identifier)
    except Abort:
        channel.abort("Could not validate the glycan source, %s, %s" % (glycan_source, glycan_source_type))
    if name is not None:
        name = validate_glycopeptide_hypothesis_name(
            context, database_connection, name)

    glycan_hypothesis_id = _glycan_hypothesis_builders[
        glycan_source_type](database_connection, glycan_source,
                            name, glycan_source_identifier)

    builder = MultipleProcessMzIdentMLGlycopeptideHypothesisSerializer(
        mzid_file, database_connection,
        glycan_hypothesis_id=glycan_hypothesis_id,
        hypothesis_name=name,
        target_proteins=proteins,
        max_glycosylation_events=occupied_glycosites,
        n_processes=processes)
    try:
        builder.start()
        record = project_hypothesis.HypothesisRecordSet(database_connection)
        hypothesis_record = None

        for item in record:
            if item.uuid == builder.hypothesis.uuid:
                hypothesis_record = item
                hypothesis_record = hypothesis_record._replace(user_id=channel.user.id)
                channel.send(Message(hypothesis_record.to_json(), "new-hypothesis"))
                break
        else:
            channel.send(Message("Something went wrong (%r)" % (list(record),)))
    except Exception:
        channel.abort(Message.traceback())


class BuildGlycopeptideHypothesisMzId(Task):
    def __init__(self, database_connection, mzid_file, name, occupied_glycosites, target_protein,
                 processes, glycan_source, glycan_source_type, glycan_source_identifier,
                 callback=lambda: 0, **kwargs):
        args = (database_connection, mzid_file, name, occupied_glycosites, target_protein,
                processes, glycan_source, glycan_source_type, glycan_source_identifier)
        job_name = "mzIdentML Glycopeptide Hypothesis %s" % (name,)
        kwargs.setdefault('name', job_name)
        super(BuildGlycopeptideHypothesisMzId, self).__init__(mzid_glycopeptide, args, callback, **kwargs)
