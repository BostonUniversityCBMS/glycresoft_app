from flask import Response, g, jsonify
from ..task.dummy_task import DummyTask
from .service_module import register_service

task_actions = register_service("task_management", __name__)


@task_actions.route("/internal/log/<task_name>")
def send_log(task_name):
    try:
        log_file = g.manager.get_task_path(task_name + '.log')
        wrapper = """<pre class='log-display' data-log-name="{task_name}">{content}</pre>"""
        log_buffer = open(log_file, 'r').read()
        formatted_buffer = log_buffer.replace(
            ">", "&gt;").replace("<", "&lt;")
        encoded_contents = formatted_buffer.decode('string_escape')
        log_content = wrapper.format(
            task_name=task_name, content=encoded_contents)
        return Response(log_content, mimetype='text/html')
    except (KeyError, IOError):
        return Response("<span class='red-text'>There does not appear to be a log for this task</span>")


@task_actions.route("/internal/cancel_task/<task_id>")
def cancel_task(task_id):
    g.manager.cancel_task(task_id)
    return Response(task_id)


@task_actions.route("/internal/test_task")
def schedule_dummy_task():
    task = DummyTask()
    g.add_task(task)
    return jsonify(task_id=task.id)
