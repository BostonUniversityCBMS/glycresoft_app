import re

from flask import request

from werkzeug.serving import run_simple
from werkzeug.wsgi import LimitedStream


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


class AddressFilteringMiddleware(object):
    def __init__(self, app, blacklist=None, whitelist=None):
        if blacklist is None:
            blacklist = []
        if whitelist is None:
            whitelist = []
        self.app = app
        self.blacklist = []
        self.whitelist = []

        for item in blacklist:
            self.add_address_to_filter(item)

        for item in whitelist:
            self.add_address_to_allow(item)

    def __call__(self, environ, start_response):
        client_ip = environ['REMOTE_ADDR']
        for pattern in self.whitelist:
            if pattern.match(client_ip):
                return self.app(environ, start_response)
        for pattern in self.blacklist:
            if pattern.match(client_ip):
                start_response("403", {})
                return iter(("Connection Refused!",))
        else:
            return self.app(environ, start_response)

    def add_address_to_filter(self, ipaddr):
        pattern = re.compile(ipaddr)
        self.blacklist.append(pattern)

    def add_address_to_allow(self, ipaddr):
        pattern = re.compile(ipaddr)
        self.whitelist.append(pattern)


class AddressFilteringApplication(object):
    def __init__(self, app, blacklist=None, whitelist=None):
        if blacklist is None:
            blacklist = []
        if whitelist is None:
            whitelist = []
        self.app = app
        self._whitelist = list(whitelist)
        self._blacklist = list(blacklist)
        self._filter = AddressFilteringMiddleware(
            self.app.wsgi_app, self._blacklist, self._whitelist)
        self.app.wsgi_app = self._filter

    def blacklist(self, ipaddr):
        self._filter.add_address_to_filter(ipaddr)

    def whitelist(self, ipaddr):
        self._filter.add_address_to_allow(ipaddr)


class ApplicationServer(object):
    def __init__(self, app, port, host, debug):
        self.app = app
        self.port = port
        self.host = host
        self.debug = debug

    def shutdown_server(self):
        self.shutdown()


class ApplicationServerManager(object):
    pass


class WerkzeugApplicationServer(ApplicationServer):
    def __init__(self, app, port, host, debug):
        super(WerkzeugApplicationServer, self).__init__(app, port, host, debug)

    def shutdown(self):
        func = request.environ.get('werkzeug.server.shutdown')
        if func is None:
            raise RuntimeError('Not running with the Werkzeug Server')

        func()

    def run(self):
        run_simple(
            hostname=self.host, port=self.port, application=self.app,
            threaded=True, use_debugger=self.debug, use_reloader=False,
            passthrough_errors=True)


ApplicationServerManager.werkzeug_server = WerkzeugApplicationServer


try:
    from twisted.web.wsgi import WSGIResource
    from twisted.python.threadpool import ThreadPool
    from twisted.internet import reactor
    from twisted.web.server import Site

    class TwistedApplicationServer(ApplicationServer):
        def __init__(self, app, port, host, debug):
            super(TwistedApplicationServer, self).__init__(app, port, host, debug)
            self.reactor = reactor
            self.thread_pool = ThreadPool(5, 40)
            self.resource = WSGIResource(
                self.reactor,
                self.thread_pool,
                self.app)
            self.reactor.addSystemEventTrigger(
                'after', 'shutdown', self.thread_pool.stop)

        def run(self):
            print("Begin Listening")
            self.thread_pool.start()
            self.reactor.listenTCP(self.port, Site(self.resource), interface=self.host)
            self.reactor.run()

        def shutdown(self):
            print("Received call to shutdown")
            print("Reactor should have stopped")
            self.reactor.callFromThread(self.reactor.stop)
            print("Reactor stop listening")
            self.reactor.callFromThread(self.reactor.stopListening)
            print("Reactor Shutdown")

    ApplicationServerManager.twisted_server = TwistedApplicationServer

except ImportError:
    pass
