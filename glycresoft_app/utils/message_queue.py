import datetime
from uuid import uuid4
from collections import defaultdict, namedtuple

try:
    from Queue import Queue
except ImportError:
    from queue import Queue

from glycresoft_app.utils.base import SyncableStore


SessionIdentity = namedtuple("SessionIdentity", ["user_id", "session_id"])
_UserIdentity = namedtuple("UserIdentity", ["id", "info"])


class UserIdentity(_UserIdentity):
    def has_access(self, record):
        user_id = str(record.user_id)
        permission = (
            (user_id == self.id) or
            (user_id == null_user.id) or
            (self.id == super_user.id) or
            (self.id is None)
        )
        return permission

    @property
    def name(self):
        display_name = self.info.get("display_name")
        if display_name:
            return display_name
        name = self.info.get("name")
        if name:
            return name
        email = self.info.get("email")
        if email:
            return email

        return self.id


class UserMetadataBundle(object):
    def __init__(self, arg=None, **kwargs):
        self.data = kwargs
        if arg is not None:
            self.data.update(arg)

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value):
        self.data[key] = value

    def __getattr__(self, key):
        return self.get(key)

    def __getstate__(self):
        return self.data

    def __setstate__(self, data):
        self.data = data

    def __reduce__(self):
        return self.__class__, (self.data,)

    def __eq__(self, other):
        if isinstance(other, UserMetadataBundle):
            return True
        else:
            return NotImplemented

    def __hash__(self):
        return hash("User Metadata Bundle Constant Function")

    def __ne__(self, other):
        if isinstance(other, UserMetadataBundle):
            return False
        else:
            return NotImplemented

    def __repr__(self):
        return "UserMetadataBundle(%r)" % {k: v for k, v in self.data.items()
                                           if not k.startswith("_")}

    def to_json(self):
        return self.data

    def __iter__(self):
        return iter(self.data)

    def __getitem__(self, key):
        return self.get(key)


def structure(*args, **kwargs):
    fields = args[1]

    if "to_json" not in kwargs:
        def to_json(self):
            return self._asdict()
    else:
        to_json = kwargs.pop("to_json")

    new_type = namedtuple(*args, **kwargs)

    derived_type = type(args[0], (new_type,), {"to_json": to_json})
    derived_type.__new__.__defaults__ = ((None,) * (len(fields)))
    return derived_type


UserRecord = structure("UserRecord", ["user_id", "metadata", "authentication"])


def has_access(record, user):
    if user is None:
        return True
    else:
        return user.has_access(record)


class UserManager(SyncableStore):
    record_type = UserRecord

    @classmethod
    def make_instance_record(cls, entry):
        user_record = UserRecord(
            entry['user_id'],
            UserMetadataBundle(entry['metadata']),
            entry.get("authentiation", None))
        return user_record

    @staticmethod
    def store_record(store, record):
        store[record.user_id] = record

    @staticmethod
    def list_files():
        return []


class IdentityProvider(object):
    """Centralizes the minting of new UserIdentity and SessionIdentity
    objects, and tracks the relationship between user ids and session ids,
    though this behavior is also available through the SessionManager.

    Attributes
    ----------
    store : defaultdict(set)
        Mapping from UserIdentity to SessionIdentities
    """
    def __init__(self, syncfile=None):
        self.store = defaultdict(set)
        self.syncfile = syncfile
        if syncfile is not None:
            pass

    def new_session(self, user):
        new_id = str(uuid4())
        ses = SessionIdentity(user.id, new_id)
        self.store[user.id].add(ses.session_id)
        return ses

    def new_user(self, new_id=None, **kwargs):
        if new_id is None:
            new_id = str(uuid4())
        else:
            new_id = str(new_id)
        return UserIdentity(new_id, UserMetadataBundle(kwargs))

    def sync(self):
        pass


# Common IdentityProvider for all applications.
identity_provider = IdentityProvider()

# Everyone has access to the Null User's project objects
null_user = identity_provider.new_user(0)
# The Super User has access to everyone's project objects
super_user = identity_provider.new_user(-1)


class SessionManager(object):
    """Handles the tracking of UserIdentity to MessageQueueSessions,
    and as a wrapper around the underlying MessageQueueManager.

    Attributes
    ----------
    message_queue_manager : MessageQueueManagerBase
        The message queue that all messages are sent through
    session_map : defaultdict(dict)
        Mapping from UserIdentity to SessionIdentity -> MessageQueueSession
    """
    def __init__(self, message_queue_manager):
        self.message_queue_manager = message_queue_manager
        self.session_map = defaultdict(dict)

    def __iter__(self):
        return iter(self.session_map)

    def remove_user(self, identifier):
        sessions = self.user_sessions(identifier.user_id)
        for session in list(sessions):
            self.remove_session(session)
        self.session_map.pop(identifier)

    def remove_session(self, identifier):
        self.message_queue_manager.remove_queue(identifier)
        sessions = self.session_map[identifier.user_id]
        try:
            sessions.pop(identifier.session_id)
        except KeyError:
            pass

    def get_session(self, session_identifier):
        sessions_for_user = self.session_map[session_identifier.user_id]
        try:
            return sessions_for_user[session_identifier.session_id]
        except KeyError:
            new_session = self.create_new_session(session_identifier)
            sessions_for_user[session_identifier.session_id] = new_session
            return new_session

    def user_sessions(self, user_id):
        """Return an iteratable over all message
        queue sessions owned by the user designated by
        `user_id`

        Parameters
        ----------
        user_id : str
            A unique identifier for a user

        Returns
        -------
        Iterable
        """
        sessions_for_user = self.session_map[user_id]
        return sessions_for_user.values()

    def create_new_session(self, session_identifier):
        return MessageQueueSession(
            self,
            session_identifier)

    def _get_queue(self, session_identifier):
        return self.message_queue_manager.get_queue(session_identifier)

    def add_message(self, message, user_id=None):
        if user_id is None:
            if message.user is not None:
                user_id = message.user
            else:
                raise ValueError("Must provide a recipient user!")
        if isinstance(user_id, SessionIdentity):
            user_id = user_id.user_id
        elif isinstance(user_id, UserIdentity):
            user_id = user_id.id
        self.message_queue_manager.add_message(message, user_id)

    def put(self, message):
        if message.user is not None:
            user_id = message.user
        else:
            raise ValueError("Must provide a recipient user!")
        self.add_message(message, user_id)

    def __repr__(self):
        return "SessionManager(%r)" % self.message_queue_manager


class MessageQueueManagerBase(object):

    def __init__(self, **kwargs):
        self.session_manager = SessionManager(self)

    def add_message(self, message, user_id):
        raise NotImplementedError()

    def remove_messages_for(self, session_identifier):
        raise NotImplementedError()

    def get_queue(self, session_identifier):
        raise NotImplementedError()

    def remove_queue(self, session_identifier):
        raise NotImplementedError()

    def sync(self):
        pass

    def __repr__(self):
        return "{self.__class__.__name__}()".format(self=self)


class MemoryMessageQueueManager(MessageQueueManagerBase):
    """A simple MessageQueueManager that holds all message queues in memory.

    Attributes
    ----------
    storage : defaultdict(Queue)
        Mapping from SessionIdentity to thread-safe Queue
    """
    def __init__(self, **kwargs):
        super(MemoryMessageQueueManager, self).__init__(**kwargs)
        self.storage = defaultdict(Queue)

    def add_message(self, message, user_id):
        for session in self.session_manager.user_sessions(user_id):
            queue = self.storage[session.identifier]
            queue.put(message)

    def get_queue(self, session_identifier):
        return self.storage[session_identifier]

    def remove_queue(self, session_identifier):
        try:
            self.storage.pop(session_identifier)
        except KeyError:
            pass


class MessageQueueSession(object):
    """A read-only endpoint for a MessageQueue which can deliver messages to
    a single location. Associated with a SessionIdentity, and should only be
    created through a SessionManager's :meth:`create_new_session` method.

    Attributes
    ----------
    connected_at : datetime.datetime
        The time the connection was made.
    identifier : SessionIdentity
        The unique identifier for this session
    message_queue : Queue-like
        Any object which supports the method `get(block, timeout)` to fetch
        one item.
    session_manager : SessionManager
        The manager which governs the connection between this session and the
        underlying MessageQueueManager
    """
    def __init__(self, session_manager, identifier):
        self.session_manager = session_manager
        self.identifier = identifier
        self.connected_at = datetime.datetime.now()
        self.message_queue = session_manager._get_queue(self.identifier)

    def __repr__(self):
        return "MessageQueueSession(%s, %s)" % (self.identifier, self.session_manager)

    def get(self, block=True, timeout=None):
        return self.message_queue.get(block, timeout)

    def close(self):
        self.session_manager.remove_session(self.identifier)


def make_message_queue(message_queue_type=MemoryMessageQueueManager, params=None, **kwargs):
    if params is None:
        params = dict()
    params.update(kwargs)
    queue_manager = message_queue_type(**params)
    return queue_manager.session_manager
