import os
import json
import logging


logger = logging.getLogger("syncable_store")


def exploding_callable(*args, **kwargs):
    raise NotImplementedError()


class SyncableStore(object):
    record_type = exploding_callable

    def __init__(self, storefile, data=None):
        if data is None:
            data = dict()
        self.data = data
        self.values = list(self.data.values())
        self.storefile = storefile
        if data:
            self.dump()
        else:
            try:
                self.load()
            except IOError as e:
                if e.errno == 2:
                    self.dump()
                    self.load()
                else:
                    raise e

    def put(self, record):
        self.data[record.uuid] = record
        self.values.append(record)

    def dump(self):
        store = dict()
        for key, record in self.data.items():
            store[key] = record.to_json()
        with open(self.storefile, 'w') as handle:
            json.dump(store, handle, sort_keys=True, indent=4)

    @classmethod
    def make_instance_record(cls, entry):
        return cls.record_type(**entry)

    def recover(self, store, raw_data):
        record_set = self.make_record(self.open_file(raw_data['path']))
        self.store_record(store, record_set)

    def load(self):
        data = dict()
        with open(self.storefile) as handle:
            raw_data = json.load(handle)
        for key in list(raw_data):
            try:
                data[key] = self.make_instance_record(raw_data[key])
            except TypeError:
                try:
                    self.recover(data, raw_data[key])
                except:
                    logger.error("Failed to make record for %r in %s" % (
                        key, self.__class__.__name__))

        self.data = data
        self.values = list(self.data.values())

    @property
    def basepath(self):
        return os.path.dirname(self.storefile)

    def __iter__(self):
        return iter(self.values)

    def __getitem__(self, i):
        return self.values[i]

    def get(self, key):
        return self.data[key]

    def path(self, uuid):
        record = self.data[uuid]
        return os.path.join(self.basepath, record.path)

    def __repr__(self):
        return "%s(%r)" % (self.__class__.__name__, self.storefile)

    @staticmethod
    def open_file(path):
        raise NotImplementedError()

    @classmethod
    def make_record(cls, datum):
        raise NotImplementedError()

    @staticmethod
    def list_files(path):
        raise NotImplementedError()

    @staticmethod
    def store_record(store, record):
        store[record.uuid] = record

    @classmethod
    def find_files(cls, base_path):
        files = cls.list_files(base_path)
        store = dict()
        for index_file in files:
            reader = cls.open_file(index_file)
            record = cls.make_record(reader)
            cls.store_record(store, record)
        return store

    @classmethod
    def build(cls, base_path, storefile):
        store = cls.find_files(base_path)
        inst = cls(storefile, store)
        inst.dump()
        return inst

    def rebuild(self):
        base_path = os.path.dirname(self.storefile)
        self.build(base_path, self.storefile)
        self.load()
