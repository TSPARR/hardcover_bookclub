import json

from django import template

register = template.Library()


@register.filter
def pprint(value):
    """Pretty print a Python object"""
    try:
        return json.dumps(value, indent=2)
    except:
        return str(value)
