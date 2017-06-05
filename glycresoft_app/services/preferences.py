from flask import g, jsonify, render_template, request
from .service_module import register_service


app_config = register_service("preferences", __name__)


default_preferences = {
    "minimum_ms2_score": 20.,
    "minimum_ms1_score": 0.6,
    "color_palette": "NGlycanCompositionColorizer"
}


preference_schema = {
    "minimum_ms1_score": float,
    "minimum_ms2_score": float,
    "color_palette": str
}


def enforce_schema(settings):
    return {k: preference_schema[k](v) for k, v in settings.items()}


@app_config.route("/preferences")
def show_preferences():
    preferences = g.manager.preferences(g.user.id)
    preferences = enforce_schema(preferences)
    for k, v in default_preferences.items():
        if k not in preferences:
            preferences[k] = preference_schema[k](v)
    return render_template("components/preferences.templ", **preferences)


@app_config.route("/preferences", methods=["POST"])
def update_preferences():
    new_preferences = request.values.to_dict()
    print("new_preferences")
    try:
        preferences = g.manager.preferences(g.user.id)
    except KeyError:
        preferences = {}
    for k, v in default_preferences.items():
        if k not in preferences:
            preferences[k] = preference_schema[k](v)
    preferences.update(new_preferences)
    preferences = enforce_schema(preferences)
    g.manager.set_preferences(g.user.id, preferences)
    print("\n%r\n" % g.manager.preferences(g.user.id))
    return jsonify(**dict(preferences.items()))
