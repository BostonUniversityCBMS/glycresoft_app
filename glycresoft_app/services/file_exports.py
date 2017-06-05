import os
import shutil
import base64
import zipfile
import logging

from flask import Response, g, abort, request, render_template, jsonify
from .service_module import register_service
from . import form_cleaners


file_exports = register_service("file_exports", __name__)

logger = logging.getLogger("glycresoft_app.file_exports")


@file_exports.route("/copy-file-form", methods=["GET"])
def copy_file_to_server():
    return render_template("components/copy_file_to_server.templ")


@file_exports.route("/copy-file-form", methods=["POST"])
def copy_file_to_server_post():
    print(request.files['target-file'])
    return Response("Done")


def resolve_file_name(name):
    path = os.path.join(g.manager.temp_dir, name)
    return path


@file_exports.route("/internal/file_download/<b64name>")
def download_file(b64name):
    name = base64.b64decode(b64name)
    path = resolve_file_name(name)
    if os.path.exists(path):
        def yielder():
            for line in open(path, 'rb'):
                yield line
        return Response(yielder(), mimetype="application/octet-stream",
                        headers={"Content-Disposition": "attachment; filename=%s" % name})
    else:
        logger.info("Requested path %r, but file not found" % (path,))
        return abort(404)


@file_exports.route("/internal/multiple_file_download/", methods=["POST"])
def download_multiple_files():
    filenames = request.values.getlist("filenames[]")
    good_names = []
    for name in filenames:
        path = resolve_file_name(name)
        if os.path.exists(path):
            good_names.append(path)
        else:
            g.add_message("Could not locate file %r" % (str(name),))
    archive_name = request.values.get("download_name", None)
    if archive_name is None:
        archive_name = form_cleaners.get_random_string()
    archive_name += ".zip"
    archive_path = resolve_file_name(archive_name)
    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED, True) as zip_handle:
        for path in good_names:
            zip_handle.write(path, os.path.basename(path))
    return jsonify(filename=archive_name)


@file_exports.route("/internal/move_files", methods=["POST"])
def move_files():
    if not g.has_native_client:
        return jsonify(status="failure", reason="method not allowed")
    destination = request.values.get("destination")
    if destination is None:
        return jsonify(status="failure", reason="no destination specified")
    if not os.path.exists(destination):
        return jsonify(status="failure", reason="destination does not exist")

    filenames = request.values.getlist("filenames[]")
    good_names = []
    for name in filenames:
        path = resolve_file_name(name)
        if os.path.exists(path):
            good_names.append(path)
        else:
            g.add_message("Could not locate file %r" % (str(name),))

    for file_path in good_names:
        shutil.move(
            file_path, os.path.join(
                destination,
                os.path.basename(file_path)))
    return jsonify(status="success", reason=None)
