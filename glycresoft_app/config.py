import os
try:
    from ConfigParser import ConfigParser
except ImportError:
    from configparser import ConfigParser


default_config = {
    "WebServer": {
        "HealthCheckInterval": 10000,
        "AllowExternalConnections": False,
    },
    "Database": {
        "RemoteAddress": None,
    },
    "TaskHandling": {
        "RefreshTaskInterval": 25000,
    },
    "Performance": {
        "PreprocessorWorkerCount": 5,
        "DatabaseBuildWorkerCount": 4,
        "DatabaseSearchWorkerCount": 5,
    }
}


def _make_parser_with_defaults():
    parser = ConfigParser()
    for section, options in default_config.items():
        parser.add_section(section)
        for name, value in options.items():
            # If a value is missing from the file and
            # must be parsed from the defaults, the
            # value must be stored as a string for the
            # type parsing facilities to not error out.
            parser.set(section, name, str(value))
    return parser


def write(config_dict, path):
    converted = {
        "WebServer": {
            "AllowExternalConnections": str(config_dict['allow_external_connections']),
            "HealthCheckInterval": str(config_dict['upkeep_interval']),
        },
        "TaskHandling": {
            "RefreshTaskInterval": str(config_dict["refresh_task_interval"]),
        },
        "Performance": {
            "PreprocessorWorkerCount": str(config_dict['preprocessor_worker_count']),
            "DatabaseBuildWorkerCount": str(config_dict['database_build_worker_count']),
            "DatabaseSearchWorkerCount": str(config_dict['database_search_worker_count'])
        }
    }
    parser = ConfigParser()
    for section, options in converted.items():
        parser.add_section(section)
        for name, value in options.items():
            # If a value is missing from the file and
            # must be parsed from the defaults, the
            # value must be stored as a string for the
            # type parsing facilities to not error out.
            parser.set(section, name, str(value))
    parser.write(open(path, 'w'))


def get(path):
    parser = _make_parser_with_defaults()
    if os.path.exists(path):
        parser.read([path])
        config_dict = {
            "allow_external_connections": parser.getboolean("WebServer", "AllowExternalConnections"),
            "refresh_task_interval": parser.getint("TaskHandling", "RefreshTaskInterval"),
            "upkeep_interval": parser.getint("WebServer", "HealthCheckInterval"),
        }
        config_dict.update({
            "preprocessor_worker_count": parser.getint("Performance", "PreprocessorWorkerCount"),
            "database_build_worker_count": parser.getint("Performance", "DatabaseBuildWorkerCount"),
            "database_search_worker_count": parser.getint("Performance", "DatabaseSearchWorkerCount")
        })
        return config_dict
    else:
        parser.write(open(path, 'w'))
        return get(path)
