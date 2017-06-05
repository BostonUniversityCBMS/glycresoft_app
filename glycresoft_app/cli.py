import click

from glycan_profiling.cli.tools import tools
from glycan_profiling.cli.base import cli, HiddenOption


@cli.command()
@click.pass_context
@click.argument("project-store-root")
@click.option("-b", "--base-path", default=None, help='Location to store application instance information')
@click.option("-e", "--external", is_flag=True, help="Allow connections from non-local machines")
@click.option("-p", "--port", default=8080, type=int, help="The port to listen on")
@click.option("-m", "--multiuser", is_flag=True, default=False)
@click.option("-t", "--max-tasks", type=int, default=1)
@click.option("-x", "--native-client-key", type=str, required=False, default=None, cls=HiddenOption)
def server(context, project_store_root, base_path, external=False, port=None, no_execute_tasks=False,
           multiuser=False, max_tasks=1, native_client_key=None):
    '''
    Start a web server to allow users to build hypotheses, preprocess MS data, run
    database search analyses, and view results.
    '''
    from glycresoft_app.server import server as inner_fn
    inner_fn(context, project_store_root, base_path, external, port, multi_user=multiuser,
             max_tasks=max_tasks, native_client_key=native_client_key)


@cli.command("project")
@click.argument("path")
def project_init(path):
    from glycresoft_app.project.project import Project
    proj = Project(path)
    click.secho("%r" % (proj,))
    proj.force_build_indices()
