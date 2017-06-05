import os
import glob

from glycan_profiling import serialize

from .base import SyncableStore, structure

HypothesisRecord = structure("HypothesisRecord", ["name", 'id', 'uuid', 'path', 'hypothesis_type', "monosaccharide_bounds"])


class HypothesisRecordSet(object):
    def __init__(self, path):
        self.path = path
        self.records = []
        self.build()

    def __iter__(self):
        return iter(self.records)

    def build(self):
        connection = serialize.DatabaseBoundOperation(self.path)
        records = []

        for hypothesis in connection.query(serialize.GlycanHypothesis):
            record = HypothesisRecord(
                id=hypothesis.id,
                name=hypothesis.name, uuid=hypothesis.uuid, path=self.path,
                monosaccharide_bounds=hypothesis.monosaccharide_bounds(),
                hypothesis_type='glycan_composition')
            records.append(record)

        for hypothesis in connection.query(serialize.GlycopeptideHypothesis):
            record = HypothesisRecord(
                id=hypothesis.id,
                name=hypothesis.name, uuid=hypothesis.uuid, path=self.path,
                monosaccharide_bounds=hypothesis.monosaccharide_bounds(),
                hypothesis_type='glycopeptide')
            records.append(record)
        self.records = records


class HypothesisManager(SyncableStore):
    record_type = HypothesisRecord

    @staticmethod
    def list_files(base_path):
        indices = glob.glob(os.path.join(base_path, "*.database"))
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
        record_set = HypothesisRecordSet(datum)
        return record_set
