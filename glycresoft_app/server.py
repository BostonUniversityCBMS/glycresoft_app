from __future__ import print_function
import logging
from glycan_profiling.cli.base import cli

from flask import (
    Flask, request, session, g, redirect, url_for,
    abort, render_template, flash, Markup, make_response, jsonify,
    Response)

import click
from werkzeug.wsgi import LimitedStream

from glycresoft_app import report
# Set up json serialization methods
from glycresoft_app.utils import json_serializer
from glycresoft_app.application_manager import ApplicationManager
from glycresoft_app.services import (
    # task_management, server_sent_events, api, build_glycan_hypothesis,
    service_module)


class StreamConsumingMiddleware(object):

    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        stream = LimitedStream(environ['wsgi.input'],
                               int(environ['CONTENT_LENGTH'] or 0))
        environ['wsgi.input'] = stream
        app_iter = self.app(environ, start_response)
        try:
            stream.exhaust()
            for event in app_iter:
                yield event
        finally:
            if hasattr(app_iter, 'close'):
                app_iter.close()


app = Flask(__name__)
app.wsgi_app = StreamConsumingMiddleware(app.wsgi_app)
app.config['PROPAGATE_EXCEPTIONS'] = True
report.prepare_environment(app.jinja_env)

DATABASE = None
DEBUG = True
SECRETKEY = 'TG9yZW0gaXBzdW0gZG90dW0'
SERVER = None
manager = None

# app.register_blueprint(task_management.task_actions)
# app.register_blueprint(server_sent_events.server_sent_events)
# app.register_blueprint(api.api)
# app.register_blueprint(build_glycan_hypothesis.app)
service_module.load_all_services(app)


class ApplicationServerManager(object):
    def __init__(self, state=None):
        if state is None:
            state = dict()
        self.state = state

    @property
    def shutdown_server(self):
        return self.state["shutdown_server"]

    @shutdown_server.setter
    def shutdown_server(self, value):
        self.state["shutdown_server"] = value

    @classmethod
    def werkzeug_server(cls):
        def shutdown_func():
            func = request.environ.get('werkzeug.server.shutdown')
            if func is None:
                raise RuntimeError('Not running with the Werkzeug Server')

            func()
        inst = cls()
        inst.shutdown_server = shutdown_func
        return inst

# ----------------------------------------
# Server Shutdown
# ----------------------------------------


@app.route('/internal/shutdown', methods=['POST'])
def shutdown():
    g.manager.halting = True
    g.manager.stoploop()
    SERVER.shutdown_server()
    return Response("Should be dead")

# ----------------------------------------
#
# ----------------------------------------


@app.route("/internal/show_cache")
def show_cache():
    print(dict(g.manager.app_data))
    return Response("Printed")


def connect_db():
    g.manager = manager
    g.db = manager.session


@app.route("/")
def index():
    return render_template("index.templ")


@app.before_request
def before_request():
    connect_db()


@app.teardown_request
def teardown_request(exception):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()


@app.context_processor
def inject_info():
    from glycresoft_app.version import version
    return {
        "application_version": version
    }


def setup_logging():
    try:
        logging.basicConfig(
            level=logging.INFO, filename='glycresoft-log', filemode='w',
            format="%(asctime)s - %(processName)s:%(name)s:%(funcName)s:%(lineno)d - %(levelname)s - %(message)s",
            datefmt="%H:%M:%S")
        fmt = logging.Formatter(
            "%(asctime)s - %(processName)s:%(name)s:%(funcName)s:%(lineno)d - %(levelname)s - %(message)s", "%H:%M:%S")
        handler = logging.StreamHandler()
        handler.setFormatter(fmt)
        logging.getLogger().addHandler(handler)
    except Exception, e:
        logging.exception("Error, %r", e, exc_info=e)
        raise e


@cli.command()
@click.pass_context
@click.argument("database-connection")
@click.option("-b", "--base-path", default=None, help='Location to store application instance information')
@click.option("-e", "--external", is_flag=True, help="Allow connections from non-local clients")
@click.option("-n", "--no-execute-tasks", is_flag=True, help="Prevent the execution of tasks (read-only)")
@click.option("-p", "--port", default=8080, type=int, help="The port to listen on")
def server(context, database_connection, base_path, external=False, port=None, no_execute_tasks=False):
    global DATABASE, manager, CAN_EXECUTE, SERVER
    host = None
    if external:
        host = "0.0.0.0"
    DATABASE = database_connection
    CAN_EXECUTE = not no_execute_tasks
    print("BASE PATH", base_path)
    manager = ApplicationManager(DATABASE, base_path)
    print(manager.base_path)

    app.debug = DEBUG
    app.secret_key = SECRETKEY
    SERVER = ApplicationServerManager.werkzeug_server()
    app.run(host=host, use_reloader=False, threaded=True, debug=DEBUG, port=port, passthrough_errors=True)