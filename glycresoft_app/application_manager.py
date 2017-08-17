from time import sleep
import logging
import os
import pickle
from os import path
from threading import RLock

from glycan_profiling.serialize import (
    DatabaseBoundOperation, SampleRun, GlycanHypothesis,
    GlycopeptideHypothesis, Analysis, AnalysisTypeEnum)


from glycan_profiling.task import log_handle

from glycresoft_app.task.task_process import TaskManager
from glycresoft_app.vendor import sqlitedict
from glycresoft_app.config import get as config_from_path

from glycresoft_app.project.sample import SampleManager
from glycresoft_app.project.analysis import AnalysisManager
from glycresoft_app.project.hypothesis import HypothesisManager

from glycresoft_app.utils.message_queue import null_user


def has_access(record, user):
    if user is None:
        return True
    else:
        return user.has_access(record)


class ApplicationManager(object):
    app_data_name = "app_data.db"
    _config_file_name = "config.ini"

    project_id = None

    def __init__(self, database_connection, base_path=None):
        if base_path is None:
            base_path = os.getcwd()
        self.base_path = os.path.abspath(base_path)
        self.configuration = dict()
        self.configuration.update(
            config_from_path(
                self.configuration_path))

        self.database_connection = DatabaseBoundOperation(
            database_connection)

        self.sample_dir = path.join(self.base_path, 'sample_dir')
        self.results_dir = path.join(self.base_path, 'results_dir')
        self.hypothesis_dir = path.join(self.base_path, "hypothesis_dir")
        self.temp_dir = path.join(self.base_path, 'temp_dir')
        self.task_dir = path.join(self.base_path, 'task_dir')

        self._ensure_paths_exist()

        self.sample_manager = SampleManager(path.join(self.sample_dir, 'store.json'))
        self.analysis_manager = AnalysisManager(path.join(self.results_dir, 'analysis.json'))
        self.hypothesis_manager = HypothesisManager(path.join(self.hypothesis_dir, 'store.json'))

        self._data_lock = RLock()
        self.app_data = sqlitedict.SqliteDict(
            self.app_data_path, autocommit=True)

        self.task_manager = TaskManager(
            self.task_dir)

        self.task_manager.register_event_handler("new-sample-run", self.handle_new_sample_run)
        self.task_manager.register_event_handler("new-hypothesis", self.handle_new_hypothesis)
        self.task_manager.register_event_handler("new-analysis", self.handle_new_analysis)

        logger = logging.getLogger()
        logger.addHandler(
            logging.FileHandler(
                self.application_log_path, mode='a'))

    def __eq__(self, other):
        try:
            return self.database_connection == other.database_connection
        except AttributeError:
            return NotImplemented

    def __hash__(self):
        return hash(self.database_connection)

    def handle_new_sample_run(self, message):
        with self._data_lock:
            record = self.sample_manager.make_instance_record(message.message)
            self.sample_manager.put(record)
            self.sample_manager.dump()

    def handle_new_hypothesis(self, message):
        with self._data_lock:
            record = self.hypothesis_manager.make_instance_record(message.message)
            self.hypothesis_manager.put(record)
            self.hypothesis_manager.dump()

    def handle_new_analysis(self, message):
        with self._data_lock:
            record = self.analysis_manager.make_instance_record(message.message)
            self.analysis_manager.put(record)
            self.analysis_manager.dump()

    def make_unique_sample_name(self, sample_name):
        base_name = sample_name
        current_name = base_name
        i = 0
        existing_names = {s.name for s in self.samples()}
        with self._data_lock:
            while current_name in existing_names:
                i += 1
                current_name = "%s (%d)" % (base_name, i)
        return current_name

    def make_unique_hypothesis_name(self, hypothesis_name):
        base_name = hypothesis_name
        current_name = base_name
        i = 0
        existing_names = {s.name for s in self.hypotheses()}
        with self._data_lock:
            while current_name in existing_names:
                i += 1
                current_name = "%s (%d)" % (base_name, i)
        return current_name

    @property
    def application_log_path(self):
        return os.path.join(
            self.base_path, "glycresoft-log")

    @property
    def escaped_base_path(self):
        return self.base_path.encode("unicode_escape")

    @property
    def configuration_path(self):
        return os.path.join(
            self.base_path, self._config_file_name)

    @property
    def halting(self):
        return self.task_manager.halting

    @halting.setter
    def halting(self, value):
        self.task_manager.halting = bool(value)

    @property
    def messages(self):
        return self.task_manager.messages

    def tasks(self, user_id=None):
        tasks_dict = self.task_manager.tasks
        return {
            key: task for key, task in tasks_dict.items()
            if has_access(task, user_id)
        }

    def stoploop(self):
        return self.task_manager.stoploop()

    def add_message(self, message):
        return self.task_manager.add_message(message)

    @property
    def session(self):
        return self.database_connection.session

    @property
    def connection_bridge(self):
        return self.database_connection._original_connection

    @property
    def app_data_path(self):
        return self.get_temp_path(self.app_data_name)

    def _ensure_paths_exist(self):
        try:
            os.makedirs(self.sample_dir)
        except Exception:
            pass
        try:
            os.makedirs(self.results_dir)
        except Exception:
            pass
        try:
            os.makedirs(self.temp_dir)
        except Exception:
            pass
        try:
            os.makedirs(self.task_dir)
        except Exception:
            pass
        try:
            os.makedirs(self.hypothesis_dir)
        except Exception:
            pass

    def get_sample_path(self, name):
        return path.join(self.sample_dir, name)

    def get_temp_path(self, name):
        return path.join(self.temp_dir, name)

    def get_task_path(self, name):
        return path.join(self.task_dir, name)

    def get_results_path(self, name):
        return path.join(self.results_dir, name)

    def get_hypothesis_path(self, name):
        return path.join(self.hypothesis_dir, name)

    def make_task_context(self, name):
        return {
            "results_dir": self.get_results_path(name),
            "temp_dir": self.get_temp_path(name),
        }

    def add_task(self, task):
        log_handle.log("Received Task %r (%s, %r)" % (task, task.name, task.id))
        context = self.make_task_context(task.name)
        task.update_control_context(context)
        self.task_manager.add_task(task)
        path = self.get_task_path(task.name)
        pickle.dump(task.args[:-1], open(path, 'wb'))

    def cancel_task(self, task_id):
        self.task_manager.cancel_task(task_id)

    def cancel_all_tasks(self):
        self.task_manager.cancel_all_tasks()

    def __getitem__(self, key):
        if key == "preferences":
            raise RuntimeError()
        return self.app_data[key]

    def preferences(self, user_id=None):
        if user_id is None:
            user_id = null_user.id
        try:
            return self[user_id]['preferences']
        except KeyError:
            return {}

    def set_preferences(self, user_id=None, preferences=None):
        if preferences is None:
            return
        if user_id is None:
            user_id = null_user.id
        self.app_data.setdefault(user_id, {})
        user_data = self[user_id]
        user_data['preferences'] = preferences
        self[user_id] = user_data

    def __setitem__(self, key, value):
        self.app_data[key] = value

    def samples(self, user_id=None):
        q = [sample for sample in self.sample_manager
             if has_access(sample, user_id)]
        return q

    def hypotheses(self, user=None):
        return [
            hypothesis
            for hypothesis in self.hypothesis_manager
            if has_access(hypothesis, user)
        ]

    def glycan_hypotheses(self, user=None):
        return [
            hypothesis
            for hypothesis in self.hypothesis_manager
            if hypothesis.hypothesis_type == "glycan_composition" and
            has_access(hypothesis, user)
        ]

    def glycopeptide_hypotheses(self, user=None):
        return [
            hypothesis
            for hypothesis in self.hypothesis_manager
            if hypothesis.hypothesis_type == "glycopeptide" and
            has_access(hypothesis, user)
        ]

    def analyses(self, user=None):
        return [analysis for analysis in self.analysis_manager
                if has_access(analysis, user)]

    def glycan_analyses(self, user=None):
        return [analysis for analysis in (self.analysis_manager)
                if AnalysisTypeEnum.glycan_lc_ms == analysis.analysis_type and
                has_access(analysis, user)]

    def analyses_for_sample(self, sample_name):
        return [
            analysis for analysis in self.analysis_manager
            if analysis.sample_name == sample_name
        ]

    def get_next_job_number(self):
        with self._data_lock:
            try:
                job_count = self.app_data['_job_count']
            except KeyError:
                job_count = 0
            self.app_data['_job_count'] = job_count + 1
        return job_count

    @property
    def max_running_tasks(self):
        return self.task_manager.max_running

    @max_running_tasks.setter
    def max_running_tasks(self, count):
        self.task_manager.max_running = count


class UnknownProjectError(Exception):
    pass


class ProjectIDAllocationError(Exception):
    pass


class ProjectMultiplexer(object):
    def __init__(self):
        self.storage = dict()
        self.counter = 0
        self._lock = RLock()

    def register_project(self, project_manager):
        if project_manager.project_id is not None:
            with self._lock:
                project_id = project_manager.project_id
                if project_id in self.storage:
                    if project_manager == self.get_project(project_id):
                        return project_id
                    else:
                        raise ProjectIDAllocationError("Project Manager %r's ID has been reallocated." % (
                            project_manager,))
        with self._lock:
            self.storage[self.counter] = project_manager
            project_manager.project_id = self.counter
            self.counter += 1
        return project_manager.project_id

    def unregister_project(self, project_id):
        with self._lock:
            self.storage.pop(project_id, None)

    def get_project(self, project_id):
        try:
            with self._lock:
                project = self.storage[project_id]
            return project
        except KeyError:
            raise UnknownProjectError(project_id)

    def __len__(self):
        with self._lock:
            n = len(self.storage)
        return n

    def __iter__(self):
        with self._lock:
            gen = iter(list(self.storage.items()))
        return gen
