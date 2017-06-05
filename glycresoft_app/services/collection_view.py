import logging
from threading import RLock
from glycan_profiling.serialize import (
    DatabaseBoundOperation)

from glycan_profiling.database import lru

logger = logging.getLogger("glycresoft_app.view_services")


class ViewCache(object):
    def __init__(self, size=5):
        self.cache = dict()
        self.policy = lru.LRUCache()
        self.size = size
        self.lock = RLock()

    def __contains__(self, key):
        with self.lock:
            return key in self.cache

    def get(self, key):
        with self.lock:
            view = self.cache[key]
            self.policy.hit_node(key)
        return view

    def __getitem__(self, key):
        return self.get(key)

    def set(self, key, value):
        logger.info("Storing %r, (Total Size: %d)\n%r", key, len(self.cache), self.cache.keys())
        with self.lock:
            if len(self.cache) >= self.size:
                try:
                    to_remove = self.policy.get_least_recently_used()
                    logger.info("Removing %r", to_remove)
                    self.cache.pop(to_remove)
                    self.policy.remove_node(to_remove)
                except KeyError:
                    pass
            self.cache[key] = value
            self.policy.add_node(key)

    def __setitem__(self, key, value):
        self.set(key, value)


class CollectionViewBase(object):
    def __init__(self, storage_record):
        self.storage_record = storage_record
        self.session = None
        self._instance_lock = RLock()

    def connect(self):
        self.connection = DatabaseBoundOperation(self.storage_record.path)
        self.session = self.connection.session

    def close(self):
        if self.session is not None:
            self.session.close()
            self.session = None

    def __enter__(self):
        self._instance_lock.acquire()
        if self.session is not None:
            self.close()
        self.connect()
        self._resolve_sources()

    def __exit__(self, *args, **kwargs):
        self.close()
        self._instance_lock.release()

    def _resolve_sources(self):
        pass
