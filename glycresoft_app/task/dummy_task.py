import time

from .task_process import Task, Message, logger


lorem = """Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed
do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco
laboris nisi ut aliquip ex ea commodo consequat. Duis aute
irure dolor in reprehenderit in voluptate velit esse cillum
dolore eu fugiat nulla pariatur. Excepteur sint occaecat
cupidatat non proident, sunt in culpa qui officia deserunt
mollit anim id est laborum
"""


def echo(*args, **kwargs):
    channel = args[-1]
    for step in range(4):
        logger.info(lorem)

    channel.send(Message("Echo.... %s" % [args[:-1]], 'update', user=channel.user))


class DummyTask(Task):
    def __init__(self, *args, **kwargs):
        Task.__init__(self, echo, args, **kwargs)
