import logging
import traceback
import multiprocessing

from multiprocessing.forking import ForkingPickler

from os import path
from uuid import uuid4
from collections import defaultdict
from datetime import datetime

from multiprocessing import Process, Pipe, Event as IPCEvent, Manager as _IPCManager, get_logger as mp_get_logger

from threading import Event, Thread, RLock
try:
    from Queue import Queue, Empty as QueueEmptyException
except:
    from queue import Queue, Empty as QueueEmptyException


import psutil


from glycan_profiling.task import TaskBase, log_handle

from glycresoft_app.utils.message_queue import identity_provider, make_message_queue, null_user

TaskBase.display_fields = True

logger = logging.getLogger("task_process")
logger.setLevel("ERROR")

QUEUED = 'queued'
RUNNING = 'running'
ERROR = 'error'
STOPPED = "stopped"
FINISHED = 'finished'


def noop():
    pass


def printop(*args, **kwargs):
    print(args, kwargs)


def make_log_path(name, created_at):
    return "%s-%s" % (name, str(created_at).replace(":", "-"))


def configure_log_wrapper(log_file_path, task_callable, args, channel):
    import logging
    logger = logging.getLogger()
    handler = logging.FileHandler(log_file_path)
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s:%(funcName)s:%(lineno)d - %(levelname)s - %(message)s",
        "%H:%M:%S")
    handler.setFormatter(formatter)
    logging.captureWarnings(True)

    warner = logging.getLogger('py.warnings')
    warner.setLevel("CRITICAL")

    logger.handlers = []
    logger.addHandler(handler)
    logger.setLevel("DEBUG")
    logger.propagate = False
    current_process = multiprocessing.current_process()

    logger.info("Task Running on PID %r", current_process.pid)

    try:
        out = task_callable(*args)
        return out
    except Exception:
        channel.send(Message.traceback())
        import sys
        proc_handle = psutil.Process(current_process.pid)
        with proc_handle.oneshot():
            for child in proc_handle.children(True):
                child.kill()
        sys.exit(1)


class CallInterval(object):
    """Call a function every `interval` seconds from
    a separate thread.

    Attributes
    ----------
    stopped: threading.Event
        A synchronization point that controls when to run `call_target`
    call_target: callable
        The thing to call every `interval` seconds
    args: iterable
        Arguments for `call_target`
    interval: number
        Time between calls to `call_target`
    """

    def __init__(self, interval, call_target, *args):
        self.stopped = Event()
        self.interval = interval
        self.call_target = call_target
        self.args = args
        self.thread = Thread(target=self.mainloop)
        self.thread.daemon = True

    def mainloop(self):
        while not self.stopped.wait(self.interval):
            try:
                self.call_target(*self.args)
            except Exception:
                logger.exception("An error occurred in %r", self, exc_info=True)

    def start(self):
        self.thread.start()

    def stop(self):
        self.stopped.set()


class LoggingPipe(object):
    def __init__(self, pipe):
        self.pipe = pipe

    def send(self, message):
        if message.type == 'info':
            logger.info(str(message))
        elif message.type == 'error':
            logger.error(str(message))
        self.pipe.send(message)

    def recv(self):
        return self.pipe.recv()

    def poll(self, timeout=None):
        return self.pipe.poll(timeout)


class TaskControlContext(object):
    def __init__(self, pipe, stop_event=None, user=null_user, context=None):
        if context is None:
            context = dict()
        # else:
        #     context = dict(context)
        if stop_event is None:
            stop_event = IPCEvent()
        self.pipe = LoggingPipe(pipe)
        self.stop_event = stop_event
        self.user = user
        self.context = context

    def log(self, message):
        log_handle.log(message)

    def abort(self, message, exc_type=Exception):
        if isinstance(message, Message):
            message = message.message
        self.send(Message(message, 'error'))
        raise exc_type(message)

    def send(self, message):
        if message.user == null_user:
            message.user = self.user
        self.pipe.send(message)

    def recv(self):
        return self.pipe.recv()

    def poll(self, timeout=None):
        return self.pipe.poll(timeout)

    def update(self, context):
        self.context.update(context)

    def __getitem__(self, key):
        return self.context[key]


class Task(object):
    """
    Represents a separate process that is performing an long running operation against
    the database with a distinct endpoint. This process is executing a series of functions
    launched from within Python as opposed to simply running a 3rd-party executable, and is
    able to set up two-way communication between the main process and the "task" process.


    Attributes
    ----------
    args : iterable
        The list of arguments to the task's main function
    callback : callable
        A function to be called when the task's main function completes
    id : str
        A unique identifier for the task. Usually a UUID
    log_file_path : str
        The path for the task write all logging messages to
    message_buffer : list
        An accumulator for outbound messages from this task
    name : str
        A more human-readable description of this "task" process which may
        be displayed to the user. Defaults to :attr:`id`.
    process : multiprocessing.Process
        The actual Process object doing the work
    state : str
        One of several constants describing whether task is new, has started,
        has finished with an error, or has completed successfully
    task_fn : callable
        The function to call in the "task" process
    """
    def __init__(self, task_fn, args, callback=printop, user=null_user, context=None, **kwargs):
        if context is None:
            context = dict()
        self.id = str(uuid4())
        self.task_fn = task_fn
        self.pipe, child_conn = Pipe(True)
        self.created_at = str(datetime.now()).replace(":", "-")
        self.started_at = None
        control_context = TaskControlContext(child_conn, user=user, context=context)
        self.control_context = control_context
        self.stop_event = control_context.stop_event
        self.state = QUEUED
        self.process = None
        self.args = list(args)
        self.args.append(control_context)
        self.callback = callback
        self.name = kwargs.get('name', self.id)
        self.log_file_path = kwargs.get("log_file_path", "%s-%s.log" % (self.name, self.created_at))
        self.message_buffer = []
        self._user = None
        self.user = user

    @property
    def user(self):
        return self._user

    @property
    def user_id(self):
        return self.user.id

    @user.setter
    def user(self, value):
        self._user = value
        self.control_context.user = value

    def update_control_context(self, context):
        self.control_context.update(context)

    def start(self):
        self.process = Process(target=configure_log_wrapper, args=(
            self.log_file_path, self.task_fn, self.args, self.control_context))
        self.state = RUNNING
        self.process.start()

    def cancel(self):
        if self.state == RUNNING:
            proc_handle = psutil.Process(self.process.pid)
            with proc_handle.oneshot():
                for child in proc_handle.children(True):
                    child.kill()
            self.process.terminate()
        self.state = STOPPED

    def get_message(self):
        if len(self.message_buffer) > 0:
            message = self.message_buffer.pop(0)
            message.source = self
            return message
        if self.pipe.poll():
            message = self.pipe.recv()
            message.source = self
            return message
        return None

    def add_message(self, message):
        if isinstance(message, basestring):
            message = Message(message, "update", user=self.user)
        self.message_buffer.append(message)

    def update(self):
        if self.process is not None:
            result = self.process.is_alive()
            if not result and self.state == RUNNING:
                exitcode = self.process.exitcode
                if exitcode == 0:
                    self.state = FINISHED
                    self.on_complete()
                elif exitcode is None:
                    self.state = ERROR
                else:
                    self.state = ERROR
            return result

        return False

    def __getstate__(self):
        return {
            "id": self.id,
            "state": self.state,
            "task_fn": self.task_fn,
            "args": self.args[:-1],
            "callback": self.callback,
            "user": self.user
        }

    def __setstate__(self, state):
        self.id = state['id']
        self.task_fn = state['task_fn']
        self.state = state['state']
        self.args = state['args']
        self.callback = state['callback']
        self.user = state['user']
        self.pipe, child_conn = Pipe(True)
        control_context = TaskControlContext(child_conn, user=self.user)
        self.stop_event = control_context.stop_event
        self.args.append(control_context)
        self.process = None

    def to_json(self):
        d = dict(id=self.id, name=self.name, status=self.state, created_at=str(self.created_at))
        return d

    def messages(self):
        message = self.get_message()
        while message is not None:
            yield message
            message = self.get_message()

    def __repr__(self):
        return "<Task {} {}>".format(self.id, self.state)

    def on_complete(self):
        self.callback()


class NullPipe(object):
    """
    A class to stub out multiprocessing.Pipe
    """
    def send(self, *args, **kwargs):
        logger.info(*args, **kwargs)

    def recv(self):
        return ""

    def poll(self, timeout=None):
        return False


class Message(object):
    """
    Represent a message sent between a Task and the main process.

    Attributes
    ----------
    message : object
        Anything, but preferiably something JSON serializeable
    source : object
        Description
    type : str
        A constant similar to logging levels. Options in use include
        ("info", "error", "update")
    user : UserIdentity
    """
    def __init__(self, message, type="info", source=None, user=null_user):
        self.message = message
        self.source = source
        self.type = type
        self.user = user

    def __str__(self):
        return "%r@%s:%s - %r" % (self.user, self.source, self.type, self.message)

    @classmethod
    def traceback(cls):
        return cls(traceback.format_exc(), "error")


class TaskManager(object):
    """Track and schedule `Task` objects and associated processes.

    Attributes
    ----------
    task_dir: str
        file system directory path for writing task-specific information
    tasks: dict
        A task id -> `Task` object mapping for all tasks, running or waiting
    task_queue: Queue.Queue
        A `Queue.Queue` for holding `Task` objects currently waiting to be ran
    currently_running: dict
        A task id -> `Task` object mapping for all tasks currently running
    n_running: int
        The number of tasks currently running
    max_running: int
        The maximum number of tasks allowed to run at once
    timer: CallInterval
        A `CallInterval` object who schedules :meth:`TaskManager.tick`
    messages: Queue
        A `Queue` for holding task messages to be read by clients
    """
    interval = 5

    def __init__(self, task_dir=None, max_running=1):
        if task_dir is None:
            task_dir = "./"
        self.task_dir = task_dir
        self.tasks = {}
        self.n_running = 0
        self.max_running = max_running
        self.task_queue = Queue()
        self.currently_running = {}
        self.completed_tasks = set()
        self.timer = CallInterval(self.interval, self.tick)
        self.timer.start()
        self.messages = make_message_queue()
        self.running_lock = RLock()
        self.halting = False
        self.event_handlers = defaultdict(set)

    def register_event_handler(self, event_type, handler):
        self.event_handlers[event_type].add(handler)

    def add_task(self, task):
        """Add a `Task` object to the set of all tasks being managed
        by this instance.

        Once a task is added, it will be checked during each `tick`

        Parameters
        ----------
        task : Task
            The task to be scheduled
        """
        logger.info("Scheduling Task %r (%s, %r)" % (task, task.name, task.id))
        self.tasks[task.id] = task
        self.task_queue.put(task)
        self.add_message(Message({
            "id": task.id, "name": task.name, "created_at": task.created_at}, "task-queued"))

    def cancel_task(self, task_id):
        task = self.tasks[task_id]
        task.cancel()

    def get_task_log_path(self, task):
        return path.join(self.task_dir, task.log_file_path)

    def startloop(self):
        self.timer.start()

    def stoploop(self):
        self.timer.stop()

    def terminate(self):
        self.stoploop()
        # Clean up here
        self.cancel_all_tasks()

    def tick(self):
        """Check each managed task for status updates, schedule new tasks
        when space becomes available, remove finished tasks and handle errors.

        This method is called every :attr:`TaskManager.interval` seconds.
        """
        try:
            self.check_state()
            self.launch_new_tasks()
        except Exception, e:
            logger.exception("an error occurred in `tick`", exc_info=e)

    def cancel_all_tasks(self):
        for task_id, task in self.tasks.items():
            task.cancel()

    def check_state(self):
        """Iterate over all tasks in :attr:`TaskManager.tasks` and check their status.
        """
        logger.debug(
            "Checking task manager state:\n %d tasks running\nRunning: %r\n%r",
            self.n_running, self.currently_running, self.tasks)
        for task_id, task in list(self.tasks.items()):
            running = task.update()
            logger.debug("Checking %r", task)
            for message in task.messages():
                self.add_message(message)

            if task.state == QUEUED:
                pass
            elif task.state == FINISHED:
                if self.running_lock.acquire(0):
                    self.currently_running.pop(task.id)
                    self.tasks.pop(task.id)
                    self.n_running -= 1
                    task.on_complete()
                    self.add_message(Message(
                        {"id": task.id, "name": task.name, "created_at": str(task.created_at)}, "task-complete",
                        user=task.user))
                    self.running_lock.release()
                    self.completed_tasks.add(task.id)
            elif task.state == ERROR:
                if task.id in self.currently_running:
                    if self.running_lock.acquire(0):
                        self.currently_running.pop(task.id)
                        self.add_message(Message(
                            {"id": task.id, "name": task.name, "created_at": str(task.created_at)}, "task-error",
                            user=task.user))
                        self.tasks.pop(task.id)
                        self.n_running -= 1
                        self.running_lock.release()
            elif task.state == STOPPED:
                if task.id in self.currently_running:
                    if self.running_lock.acquire(0):
                        self.currently_running.pop(task.id)
                        self.add_message(Message(
                            {"id": task.id, "name": task.name, "created_at": str(task.created_at)}, "task-stopped",
                            user=task.user))
                        self.tasks.pop(task.id)
                        self.n_running -= 1
                        self.running_lock.release()
            elif task.state == RUNNING:
                if running:
                    continue
                else:
                    print(task.id, running)

    def launch_new_tasks(self):
        while((self.n_running < self.max_running) and (self.task_queue.qsize() > 0)):
            try:
                task = self.task_queue.get(False)
                if task.state != QUEUED or task.id in self.completed_tasks:
                    continue
                self.run_task(task)
            except QueueEmptyException:
                break

    def run_task(self, task):
        """Start running a task if space is available

        Parameters
        ----------
        task : Task
        """
        if self.running_lock.acquire(0):
            self.currently_running[task.id] = task
            self.running_lock.release()
            task.log_file_path = self.get_task_log_path(task)
            self.n_running += 1
            task.start()
            self.add_message(
                Message({"id": task.id, "name": task.name, "created_at": task.created_at}, 'task-start',
                        user=task.user))

    def add_message(self, message):
        if message.user is None:
            message.user = null_user
        for handler in self.event_handlers[message.type]:
            handler(message)
        self.messages.put(message)
