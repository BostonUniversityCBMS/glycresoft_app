import os
import glob
from .base import SyncableStore, structure

from ms_deisotope.output.mzml import ProcessedMzMLDeserializer


SampleRunRecord = structure("SampleRunRecord", ["name", "uuid", "path", "completed", "sample_type"])


class SampleManager(SyncableStore):
    record_type = SampleRunRecord

    @staticmethod
    def list_files(base_path):
        indices = glob.glob(os.path.join(base_path, "*.mzML-idx.json"))
        return indices

    @classmethod
    def make_instance_record(cls, entry):
        return cls.record_type(**entry)

    @staticmethod
    def open_file(index_file):
        data_file = index_file.rsplit("-", 1)[0]
        reader = ProcessedMzMLDeserializer(data_file, use_index=False)
        reader.read_index()
        return reader

    @classmethod
    def make_record(cls, reader):
        sample = reader.sample_run
        if len(reader.extended_index.msn_ids) > 0:
            sample_type = "MS/MS Sample"
        else:
            sample_type = "MS Sample"
        record = SampleRunRecord(
            name=sample.name, uuid=sample.uuid,
            path=reader.source_file, completed=True,
            sample_type=sample_type)
        return record
