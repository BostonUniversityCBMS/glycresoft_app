import json
import random
import logging

from flask import Response, g, request

from ..task.task_process import QueueEmptyException, Message, identity_provider
from .service_module import register_service


server_sent_events = register_service("server_sent_events", __name__)


def message_queue_stream(manager, user):
    """Implement a simple Server Side Event (SSE) stream based on the
    stream of events emit from the :attr:`TaskManager.messages` queue of `manager`.

    These messages are handled on the client side.

    At the moment, messages are not "addressed" to a particular recipient. If multiple users
    are connected at once, who receives which message is undefined. A solution to this would
    be to create labeled queues, but this requires a user identification system.

    Yields
    ------
    str: Formatted Server Side Event Message

    References
    ----------
    [1] - http://stackoverflow.com/questions/12232304/how-to-implement-server-push-in-flask-framework
    """
    try:
        payload = 'id: {id}\nevent: {event_name}\ndata: {data}\n\n'
        i = 0
        yield payload.format(id=i, event_name='begin-stream', data=json.dumps('Starting Stream'))
        yield payload.format(id=i - 1, event_name='log', data=json.dumps('Initialized'))
        i += 1
        session_identity = identity_provider.new_session(user)
        queue = manager.messages.get_session(session_identity)
        while not manager.halting:
            try:
                message = queue.get(True, 1)
                event = payload.format(
                    id=i, event_name=message.type,
                    data=json.dumps(message.message))
                i += 1
                print message, event
                yield event
            except KeyboardInterrupt:
                break
            except QueueEmptyException, e:
                # Send a comment to keep the connection alive
                if random.random() > 0.4:
                    yield payload.format(id=i, event_name='tick', data=json.dumps('Tick'))
            except Exception, e:
                logging.exception(
                    "An error occurred in message_queue_stream", exc_info=e)
    finally:
        try:
            queue.close()
        except Exception as e:
            import traceback
            traceback.print_exc(e)
            raise


@server_sent_events.route('/stream')
def message_stream():
    return Response(message_queue_stream(g.manager, g.user),
                    mimetype="text/event-stream")


@server_sent_events.route("/internal/chat", methods=["POST"])
def echo_message():
    message = request.values['message']
    user = g.user
    if request.values.get('recipient'):
        user = identity_provider.new_user(request.values.get('recipient'))
    g.manager.add_message(Message(message, type='update', user=user))
    return Response("Done")
