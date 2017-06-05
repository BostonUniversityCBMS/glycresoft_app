import logging
from flask import Response, g, jsonify, render_template, request
from .service_module import register_service


api = register_service("maintenance", __name__)

logger = logging.getLogger("glycresoft_app.js_error")


@api.route("/server_log")
def view_server_log():
    path = g.manager.application_log_path
    return Response(
        "<pre>%s</pre>" % open(path).read().replace(
            ">", "&gt;").replace(
            "<", "&lt;").decode(
            "string_escape"),
        mimetype='application/text')


@api.route("/server_settings")
def form_render():
    return render_template("components/settings-form.templ")


@api.route("/log_js_error", methods=["POST"])
def log_js_errors():
    json = request.get_json()
    logger.info("JS Error: %r\n%r" % (json, request.values))
    return Response("logged")


@api.route("/error_server")
def error_server():
    raise Exception("You asked for it!")


@api.errorhandler(Exception)
def error_logging_hook(error):
    logging.exception("Unhandled Error: %r" % error)
    return str(error), 500
