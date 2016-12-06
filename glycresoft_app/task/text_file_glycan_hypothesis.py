from click import Abort

from glycan_profiling.cli.build_db import (
    TextFileGlycanHypothesisSerializer, validate_reduction,
    validate_derivatization, validate_glycan_hypothesis_name)

from glycan_profiling.cli.validators import validate_database_unlocked

from glycresoft_app.utils import json_serializer
from .task_process import Task, Message, null_user


def build_text_file_hypothesis(text_file, database_connection, reduction, derivatization, name,
                               channel):

    if not validate_database_unlocked(database_connection):
        channel.send(Message("Database is locked.", "error"))
        return

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
        builder = TextFileGlycanHypothesisSerializer(
            text_file, database_connection,
            reduction=reduction,
            derivatization=derivatization,
            hypothesis_name=name)
        builder.start()
        channel.send(Message(json_serializer.handle_glycan_hypothesis(builder.hypothesis), "new-hypothesis"))
    except:
        channel.send(Message.traceback())


class BuildTextFileGlycanHypothesis(Task):
    def __init__(self, text_file, database_connection, reduction, derivatization, name,
                 callback, **kwargs):
        args = (text_file, database_connection, reduction, derivatization, name)
        job_name = "Glycan Hypothesis %s" % (name,)
        kwargs.setdefault('name', job_name)
        Task.__init__(self, build_text_file_hypothesis, args, callback, **kwargs)
