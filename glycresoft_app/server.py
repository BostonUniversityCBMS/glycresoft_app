from __future__ import print_function
import logging

from flask import (
    Flask, request, session, g, redirect, url_for,
    abort, render_template, flash, Markup, make_response, jsonify,
    Response, current_app)
import click

from ms_deisotope.data_source.thermo_raw import determine_if_available as has_thermo
try:
    import comtypes
    has_comtypes = True
except ImportError:
    has_comtypes = False

from glycresoft_app import report
from glycresoft_app.application_manager import (
    ApplicationManager, ProjectMultiplexer, ProjectIDAllocationError,
    UnknownProjectError)

from glycresoft_app.application_server import (
    ApplicationServerManager,
    StreamConsumingMiddleware,
    AddressFilteringApplication)


from glycresoft_app.services import (
    service_module)

from glycresoft_app.utils import message_queue


app = Flask(__name__)
app.wsgi_app = (
    StreamConsumingMiddleware(app.wsgi_app))

ip_address_filter = AddressFilteringApplication(app)

app.config['PROPAGATE_EXCEPTIONS'] = True
report.prepare_environment(app.jinja_env)

DEBUG = True
SECRETKEY = 'TG9yZW0gaXBzdW0gZG90dW0'

SERVER = None
manager = None
project_multiplexer = None
MULTIUSER_MODE = False
NATIVE_CLIENT_KEY = None

identity_provider = message_queue.identity_provider
null_user = message_queue.null_user

service_module.load_all_services(app)


# ----------------------------------------
# Server Shutdown
# ----------------------------------------


@app.route('/internal/shutdown', methods=['POST'])
def shutdown():
    for project_id, project_manager in project_multiplexer:
        try:
            project_manager.halting = True
            project_manager.stoploop()
            project_manager.cancel_all_tasks()
        except Exception:
            current_app.logger.error(
                "An error occurred while shutting down project %r" % project_id, excinfo=True)
    SERVER.shutdown_server()
    return Response("Should be dead")


@app.route('/internal/end_tasks', methods=['POST'])
def close_project():
    try:
        g.manager.halting = True
        g.manager.stoploop()
        g.manager.cancel_all_tasks()
    except Exception:
        current_app.logger.error(
            "An error occurred while shutting down project", excinfo=True)
    return Response(str(g.manager.project_id))
# ----------------------------------------
#
# ----------------------------------------


@app.route("/register_project", methods=["POST"])
def register_project():
    connection_string = request.values["connection_string"]
    base_path = request.values.get("basepath", manager.base_path)
    new_manager = ApplicationManager(connection_string, base_path)
    project_id = project_multiplexer.register_project(new_manager)
    return jsonify(project_id=project_id)


@app.route("/unregister_project", methods=["POST"])
def unregister_project():
    try:
        project_id = int(request.values["project_id"])
        project_multiplexer.unregister_project(project_id)
        return jsonify(status='success', project_id=project_id)
    except Exception:
        project_id = (request.values.get("project_id"))
        current_app.logger.error(
            "An error occurred while unregistering project %r." % project_id, exc_info=True)


# ----------------------------------------
#
# ----------------------------------------


@app.route("/internal/show_cache")
def show_cache():
    print(dict(g.manager.app_data))
    return Response("Printed")


def associate_project_context(project_id):
    g.project_id = project_id
    try:
        manager = project_multiplexer.get_project(project_id)
        g.manager = manager
        g.db = manager.session
    except UnknownProjectError:
        current_app.logger.error("Unknown Project ID %r" % project_id)
        g.manager = manager
        g.db = manager.session
    except ProjectIDAllocationError:
        current_app.logger.error("ProjectIDAllocationError %r" % project_id)
        g.manager = manager
        g.db = manager.session


@app.route("/")
def index():
    if MULTIUSER_MODE and not session.get("has_logged_in", False):
        return redirect("/login")
    return render_template("index.templ")


@app.route("/projects")
def projects():
    return render_template("components/project_view.templ")


@app.route("/login")
def login_page():
    return render_template("login.templ")


@app.route("/login", methods=["POST"])
def login_action():
    user_id = request.values['user-identity']
    session["user_id"] = user_id
    session['has_logged_in'] = True
    return redirect("/")


@app.route("/logout")
def logout_action():
    session.pop("user_id", 0)
    session['has_logged_in'] = False
    return redirect("/")


@app.route("/users/login", methods=["POST"])
def set_user_id():
    user_id = request.values.get("user_id", null_user.id)
    session["user_id"] = user_id
    return jsonify(user_id=user_id)


@app.route("/users/current_user")
def get_current_user_id():
    print(g.user)
    return jsonify(user_id=g.user.id)


@app.before_request
def before_request():
    if has_comtypes:
        comtypes.CoInitializeEx(0x0)
    # In multi-user mode, the user id should be read from the session cookie, though if
    # not we should use the null user.
    if MULTIUSER_MODE:
        user_id = session.get("user_id", null_user.id)
    # Otherwise, we should always use the null user since single user mode should not
    # be using user ids for project isolation.
    else:
        user_id = null_user.id
    # Use the user id to request the associated UserIdentity object from the global
    # identity provider. Future implementations of the IdentityProvider may cause this
    # action to fail, in which case this failure will need to be propagated somehow?
    g.user = identity_provider.new_user(user_id)

    # Use the per-connection cookie containing the project ID to attach the corrent
    # ApplicationManager instance to the context, or use the default project.
    project_id = int(request.cookies.get("project_id", 0))
    if project_id == "":
        project_id = 0

    associate_project_context(project_id)

    # Set up the context's wrappers around the ApplicationManager to
    # seamlessly propagate the user
    def add_message(message):
        if message.user is None:
            message.user = g.user
        g.manager.add_message(message)

    def add_task(task):
        if task.user == null_user and g.user != null_user:
            task.user = g.user
        g.manager.add_task(task)

    g.add_message = add_message
    g.add_task = add_task

    g.has_native_client = has_native_client()


@app.teardown_request
def teardown_request(exception):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()
    if has_comtypes:
        comtypes.CoUninitialize()


def is_logged_in():
    return g.get("user", null_user) != null_user


@app.context_processor
def inject_info():
    from glycresoft_app.version import version
    return {
        "application_version": version,
        "user": g.get("user", null_user),
        "null_user": null_user,
        "is_logged_in": is_logged_in()
    }


def has_native_client():
    key_is_not_none = request.cookies.get("native_client_key") is not None
    key_matches = request.cookies.get("native_client_key") == NATIVE_CLIENT_KEY
    return key_is_not_none and key_matches


def get_accepted_ms_file_formats():
    selection = [".mzml", ".mzML", ".mzxml", ".mzXML"]

    if has_thermo():
        selection.extend((".raw", ".RAW"))
    return ','.join(selection)


@app.context_processor
def inject_config():
    return {
        "configuration": g.manager.configuration,
        "multiuser": MULTIUSER_MODE,
        "native_client_key": NATIVE_CLIENT_KEY,
        "has_native_client": has_native_client(),
        "accepted_ms_formats": get_accepted_ms_file_formats(),
        "project": g.manager
    }


class RouteLoggingFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        is_task_api = "GET /api/tasks " not in msg
        is_task_log = "GET /internal/log/" not in msg
        if is_task_api and is_task_log:
            return True
        else:
            return False


logging.getLogger("werkzeug").addFilter(RouteLoggingFilter())


def _setup_win32_keyboard_interrupt_handler(server, manager):
    # Ensure FORTRAN handler is registered before registering
    # this handler
    from scipy import stats
    import thread
    import win32api

    def handler(dwCtrlType, hook_sigint=thread.interrupt_main):
        if dwCtrlType == 0:
            manager.halting = True
            manager.stoploop()
            manager.cancel_all_tasks()
            hook_sigint()
            print("Keyboard Interrupt Received. Shutting Down Task Queue and Scheduling Interrupt.")
            return 1
        return 0

    win32api.SetConsoleCtrlHandler(handler, 1)


def server(context, database_connection, base_path, external=False, port=None, no_execute_tasks=False,
           multi_user=False, max_tasks=1, native_client_key=None):
    global manager, SERVER, project_multiplexer, MULTIUSER_MODE, NATIVE_CLIENT_KEY
    MULTIUSER_MODE = multi_user
    NATIVE_CLIENT_KEY = native_client_key
    project_multiplexer = ProjectMultiplexer()
    manager = ApplicationManager(database_connection, base_path)
    project_multiplexer.register_project(manager)

    if MULTIUSER_MODE:
        click.secho("Multi-User Mode Enabled", fg='yellow')
    if NATIVE_CLIENT_KEY:
        click.secho("Native Key Provided: %r. Extension Activated." % (NATIVE_CLIENT_KEY,))

    manager.configuration["allow_external_connections"] |= external
    manager.max_running_tasks = max_tasks

    host = "127.0.0.1"
    if manager.configuration["allow_external_connections"]:
        click.secho("Allowing Public Access", fg='yellow')
        host = "0.0.0.0"
    app.debug = DEBUG
    app.secret_key = SECRETKEY
    try:
        _setup_win32_keyboard_interrupt_handler(SERVER, manager)
    except ImportError:
        pass
    SERVER = ApplicationServerManager.werkzeug_server(app, port, host, DEBUG)
    SERVER.run()
