import os
import glob

from glycan_profiling import serialize

from .base import SyncableStore, structure

AnalysisRecord = structure("AnalysisRecord", ["name", 'id', 'uuid', 'path', 'analysis_type', 'hypothesis_uuid',
                                              'hypothesis_name', 'sample_name'])


class AnalysisRecordSet(object):
    def __init__(self, path):
        self.path = path
        self.records = []
        self.build()

    def __iter__(self):
        return iter(self.records)

    def build(self):
        connection = serialize.DatabaseBoundOperation(self.path)
        records = []

        for analysis in connection.query(serialize.Analysis):
            record = AnalysisRecord(
                name=analysis.name,
                id=analysis.id,
                uuid=analysis.uuid,
                path=self.path,
                analysis_type=analysis.analysis_type,
                hypothesis_uuid=analysis.hypothesis.uuid,
                hypothesis_name=analysis.hypothesis.name,
                sample_name=analysis.parameters['sample_name'])
            records.append(record)
        self.records = records


class AnalysisManager(SyncableStore):
    record_type = AnalysisRecord

    @staticmethod
    def list_files(base_path):
        indices = glob.glob(os.path.join(base_path, "*.db"))
        return indices

    @staticmethod
    def open_file(db_file):
        return (db_file)

    @staticmethod
    def store_record(store, record):
        for entry in record:
            store[entry.uuid] = entry

    @classmethod
    def make_record(cls, datum):
        record_set = AnalysisRecordSet(datum)
        return record_set
