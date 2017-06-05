import re
from uuid import uuid4
from flask import Response, g, request, render_template, abort, jsonify

from .form_cleaners import intify, make_unique_name, touch_file
from .service_module import register_service

from werkzeug import secure_filename


from glypy.composition import ChemicalCompositionError
from glycopeptidepy.structure.modification import (
    extract_targets_from_string, ModificationRule, Composition)

from glycresoft_app.task.fasta_glycopeptide_hypothesis import BuildGlycopeptideHypothesisFasta
from glycresoft_app.task.mzid_glycopeptide_hypothesis import BuildGlycopeptideHypothesisMzId

from glycan_profiling.config.config_file import (
    add_user_modification_rule as add_user_peptide_modification_rule)

app = make_glycopeptide_hypothesis = register_service("make_glycopeptide_hypothesis", __name__)


@app.route("/glycopeptide_search_space")
def build_glycopeptide_search_space():
    return render_template("glycopeptide_search_space.templ", manager=g.manager)


@app.route("/glycopeptide_search_space", methods=["POST"])
def build_glycopeptide_search_space_post():
    values = request.values
    # Separate the JS-based workaround to avoid inappropriate multivalue encoding
    # being parsed incorrectly by Werkzeug
    constant_modifications = values.get("constant_modifications").split(";;;")
    variable_modifications = values.get("variable_modifications").split(";;;")

    constant_modifications = [const_mod for const_mod in constant_modifications if const_mod]
    variable_modifications = [var_mod for var_mod in variable_modifications if var_mod]

    enzyme = values.getlist("enzyme")
    if len(enzyme) == 1:
        enzyme = enzyme[0]

    hypothesis_name = values.get("hypothesis_name")
    hypothesis_name = g.manager.make_unique_hypothesis_name(hypothesis_name)

    secure_name = secure_filename(hypothesis_name if hypothesis_name is not None else "glycopeptde_database")
    storage_path = g.manager.get_hypothesis_path(re.sub(r"[\s\(\)]", "_", secure_name)) + '_glycopeptde_%s.database'
    storage_path = make_unique_name(storage_path)
    touch_file(storage_path)

    protein_list = request.files["protein-list-file"]
    protein_list_type = values.get("proteomics-file-type")
    glycan_file = request.files.get("glycan-definition-file")
    glycan_database = values.get("glycan-database-source")
    glycan_file_type = values.get("glycans-file-format")

    glycan_options = {}

    max_missed_cleavages = intify(values.get("missed_cleavages"))
    maximum_glycosylation_sites = intify(values.get("max_glycosylation_sites", 1))

    secure_protein_list = g.manager.get_temp_path(secure_filename(protein_list.filename))
    protein_list.save(secure_protein_list)

    if glycan_database == "" or glycan_database is None:
        glycan_file_type = "text"
        glycan_options["glycan_source_type"] = glycan_file_type

        secure_glycan_file = g.manager.get_temp_path(secure_filename(glycan_file.filename))
        glycan_file.save(secure_glycan_file)

        glycan_options["glycomics_source"] = secure_glycan_file
        glycan_options["glycan_source_identifier"] = None
    else:
        option_type, option_id = glycan_database.split(",", 1)

        record = g.manager.hypothesis_manager.get(option_id)
        identifier = record.id

        glycan_options["glycan_source_identifier"] = identifier

        if option_type == "Hypothesis":
            option_type = "hypothesis"
            glycan_options["glycomics_source"] = record.path
        elif option_type == "Analysis":
            option_type = "analysis"
            glycan_options["glycomics_source"] = record.path

        glycan_options["glycan_source_type"] = option_type

    n_workers = g.manager.configuration.get("database_build_worker_count", 4)
    if protein_list_type == "fasta":
        task = BuildGlycopeptideHypothesisFasta(
            storage_path, fasta_file=secure_protein_list, enzyme=enzyme,
            missed_cleavages=max_missed_cleavages, occupied_glycosites=maximum_glycosylation_sites,
            name=hypothesis_name, constant_modification=constant_modifications,
            variable_modification=variable_modifications, processes=n_workers,
            glycan_source=glycan_options["glycomics_source"],
            glycan_source_type=glycan_options["glycan_source_type"],
            glycan_source_identifier=glycan_options["glycan_source_identifier"])
        g.add_task(task)
    elif protein_list_type == 'mzIdentML':
        protein_names = values.get("protein_names").split(",")
        task = BuildGlycopeptideHypothesisMzId(
            storage_path, secure_protein_list, name=hypothesis_name,
            occupied_glycosites=maximum_glycosylation_sites, target_protein=protein_names,
            processes=n_workers, glycan_source=glycan_options['glycomics_source'],
            glycan_source_type=glycan_options['glycan_source_type'],
            glycan_source_identifier=glycan_options["glycan_source_identifier"])
        g.add_task(task)
    else:
        abort(400)
    return Response("Task Scheduled")


@app.route("/glycopeptide_search_space/modification_menu")
def show_modification_menu():
    return render_template(
        "components/modification_selection_editor.templ", id=uuid4().int)


@app.route("/glycopeptide_search_space/modification_menu", methods=["POST"])
def add_modification():
    name = request.values.get("new-modification-name")
    formula = request.values.get("new-modification-formula")
    target = request.values.get("new-modification-target")
    if name is None or name == "":
        g.add_message("Modification Name Cannot Be Empty")
        return abort(400)
    try:
        composition = Composition(str(formula))
    except ChemicalCompositionError:
        g.add_message("Invalid Formula")
        return abort(400)
    try:
        target = extract_targets_from_string(target)
    except Exception:
        g.add_message("Invalid Target Specification")
        return abort(400)
    rule = ModificationRule(target, name, None, composition.mass, composition)
    try:
        add_user_peptide_modification_rule(rule)
    except Exception:
        g.add_message("Failed to save modification rule")
        return abort(400)
    return jsonify(name=rule.name, formula=formula, mass=rule.mass, specificities=list(rule.as_spec_strings()))
