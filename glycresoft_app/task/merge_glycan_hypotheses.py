from click import Abort

from glycan_profiling.cli.build_db import (
    GlycanCompositionHypothesisMerger, validate_reduction,
    validate_derivatization, validate_glycan_hypothesis_name,
    DatabaseBoundOperation)

from glycresoft_app.project import hypothesis as project_hypothesis
from .task_process import Task, Message


def merge_glycan_hypothesis(database_connection, hypothesis_ids, name, channel):
        if name is not None:
            name = validate_glycan_hypothesis_name(None, database_connection, name)
            channel.send(Message("Merging Glycan Hypothesis %s" % name, 'info'))
        try:
            task = GlycanCompositionHypothesisMerger(database_connection, [
                (conn, hid) for conn, hid in hypothesis_ids], name)
            task.start()
            record = project_hypothesis.HypothesisRecordSet(database_connection)
            hypothesis_record = None

            for item in record:
                if item.uuid == task.hypothesis.uuid:
                    hypothesis_record = item
                    hypothesis_record = hypothesis_record._replace(user_id=channel.user.id)
                    channel.send(Message(hypothesis_record.to_json(), "new-hypothesis"))
                    break
            else:
                channel.send(Message("Something went wrong (%r)" % (list(record),)))

        except Exception:
            channel.send(Message.traceback())
            channel.abort("An error occurred during merging.")


class MergeGlycanHypotheses(Task):
    def __init__(self, database_connection, hypothesis_ids, name,
                 callback, **kwargs):
        args = (database_connection, hypothesis_ids, name)
        job_name = "Merged Glycan Hypothesis %s" % (name,)
        kwargs.setdefault('name', job_name)
        Task.__init__(self, merge_glycan_hypothesis, args, callback, **kwargs)
