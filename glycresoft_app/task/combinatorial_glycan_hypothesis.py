from click import Abort

from glycan_profiling.cli.build_db import (
    CombinatorialGlycanHypothesisSerializer, validate_reduction,
    validate_derivatization, validate_glycan_hypothesis_name)

# from glycresoft_app.utils import json_serializer
from glycresoft_app.project import hypothesis as project_hypothesis
from .task_process import Task, Message


def build_combinatorial_hypothesis(rule_file, database_connection, reduction, derivatization, name, channel):
    if name is not None:
        name = validate_glycan_hypothesis_name(None, database_connection, name)
        channel.send(Message("Building Glycan Hypothesis %s" % name, 'info'))
    try:
        reduction = str(reduction) if reduction is not None else None
        validate_reduction(None, reduction)
    except Abort:
        channel.send(Message("Could not validate reduction %s" % reduction), 'error')
        return
    try:
        derivatization = str(derivatization) if derivatization is not None else None
        validate_derivatization(None, derivatization)
    except Abort:
        channel.send(Message("Could not validate derivatization %s" % derivatization, 'error'))
        return
    try:
        builder = CombinatorialGlycanHypothesisSerializer(
            rule_file, database_connection,
            reduction=reduction,
            derivatization=derivatization,
            hypothesis_name=name)
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
        channel.send(Message.traceback())
        raise


class BuildCombinatorialGlycanHypothesis(Task):
    def __init__(self, rule_file, database_connection, reduction, derivatization, name,
                 callback, **kwargs):
        args = (rule_file, database_connection, reduction, derivatization, name)
        job_name = "Combinatorial Glycan Hypothesis %s" % (name,)
        kwargs.setdefault('name', job_name)
        Task.__init__(self, build_combinatorial_hypothesis, args, callback, **kwargs)
