from flask import request, g
from glycan_profiling.database import glycan_composition_filter


class FilterSpecificationSet(object):
    def __init__(self, constraints=None):
        if constraints is None:
            constraints = tuple()
        self.constraints = constraints

    def __eq__(self, other):
        return self.constraints == other.constraints

    def __ne__(self, other):
        return not (self == other)

    def __len__(self):
        return len(self.constraints)

    def __hash__(self):
        return hash(self.constraints)

    def items(self):
        for constraint in self.constraints:
            yield constraint.monosaccharide, constraint

    @classmethod
    def fromdict(cls, filters):
        filters = [MonosaccharideFilterSpecification(monosaccharide=monosaccharide, **constraint)
                   for monosaccharide, constraint in filters.items()]
        filters = tuple(filters)
        return cls(filters)

    def __repr__(self):
        return "FilterSpecificationSet(%r)" % (self.constraints,)

    def to_filter_query(self, filter_set):
        if len(self) == 0:
            return glycan_composition_filter.QueryComposer(filter_set)
        first_spec = self.constraints[0]
        if first_spec.include:
            q = filter_set.query(first_spec.monosaccharide, first_spec.minimum, first_spec.maximum)
        else:
            q = filter_set.query(first_spec.monosaccharide, 0, 0)
        for spec in self.constraints[1:]:
            if spec.include:
                q.add(spec.monosaccharide, spec.minimum, spec.maximum)
            else:
                q.add(spec.monosaccharide, 0, 0)
        return q


class MonosaccharideFilterSpecification(object):
    def __init__(self, monosaccharide, minimum, maximum, include):
        self.monosaccharide = monosaccharide
        self.minimum = int(minimum)
        self.maximum = int(maximum)
        self.include = include

    def __eq__(self, other):
        return self.monosaccharide == other.monosaccharide and\
            self.minimum == other.minimum and\
            self.maximum == other.maximum and\
            self.include == other.include

    def __hash__(self):
        return hash((self.monosaccharide, self.minimum, self.maximum,
                     self.include))

    def __getitem__(self, key):
        return self.__dict__[key]

    def __repr__(self):
        return "MonosaccharideFilterSpecification(monosaccharide=%r, minimum=%d, maximum=%d, include=%r)" % (
            self.monosaccharide, self.minimum, self.maximum, self.include)


def literal_typecast(s):
    if isinstance(s, list):
        return literal_typecast_list(s)
    elif isinstance(s, dict):
        return literal_typecast_dict(s)
    try:
        return float(s)
    except (ValueError, TypeError):
        return str(s)


def literal_typecast_list(d):
    return [literal_typecast(v) for v in d]


def literal_typecast_dict(d):
    if d is None:
        return None
    return {
        k: literal_typecast(v) for k, v in d.items()
    }


def request_arguments_and_context():
    parameters = request.get_json()
    if parameters is None:
        return (), ApplicationState(dict(), dict(), FilterSpecificationSet.fromdict({}))
    context = literal_typecast_dict(parameters.get("context", {}))
    settings = literal_typecast_dict(parameters.get("settings", {}))
    arguments = {k: v for k, v in parameters.items() if k not in ("context", "settings")}

    monosaccharide_filters = settings.pop("monosaccharide_filters", {})
    monosaccharide_filters = FilterSpecificationSet.fromdict(monosaccharide_filters)

    return arguments, ApplicationState(settings, context, monosaccharide_filters)


class ApplicationState(object):
    def __init__(self, settings, context, monosaccharide_filters):
        self.settings = settings
        self.context = context
        self.monosaccharide_filters = monosaccharide_filters

    def __getattr__(self, key):
        try:
            return self.settings[key]
        except KeyError:
            try:
                return self.context[key]
            except KeyError:
                raise AttributeError(key)

    def __repr__(self):
        return "ApplicationState\n%r \n %r \n%r" % (self.settings, self.context, self.monosaccharide_filters)
