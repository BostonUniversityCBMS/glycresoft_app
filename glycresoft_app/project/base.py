from collections import namedtuple

from glycresoft_app.utils.message_queue import null_user

from glycresoft_app.utils.base import SyncableStore


def structure(*args, **kwargs):
    fields = args[1]

    if "user_id" not in fields:
        fields.append("user_id")

    if "to_json" not in kwargs:
        def to_json(self):
            return self._asdict()
    else:
        to_json = kwargs.pop("to_json")

    new_type = namedtuple(*args, **kwargs)

    derived_type = type(args[0], (new_type,), {"to_json": to_json})
    derived_type.__new__.__defaults__ = ((None,) * (len(fields) - 1) + (null_user.id,))
    return derived_type
