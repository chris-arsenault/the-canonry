export const cannonGrammar = String.raw`
{
  function span(loc) {
    const file = (options && options.file) ? options.file : '<unknown>';
    return {
      file,
      start: { line: loc.start.line, column: loc.start.column, offset: loc.start.offset },
      end: { line: loc.end.line, column: loc.end.column, offset: loc.end.offset }
    };
  }

  function attr(key, value) {
    return {
      type: "attribute",
      key,
      value,
      labels: [],
      span: span(location())
    };
  }
}

Start
  = _ statements:Statement* { return statements.filter(Boolean); }

Statement
  = _ stmt:(AxisLine
    / TagLine
    / RelationshipKindLine
    / SeedRelationshipLine
    / RelStatement
    / MutateStatement
    / PredicateStatement
    / InStatement
    / FromStatement
    / Block
    / LabeledAttribute
    / Attribute
    / BareStatement) LineEnd? { return stmt; }
  / LineEnd { return null; }

AxisLine
  = AxisKeyword __1 id:Identifier __1 name:AxisName __1 low:AxisValue _ "->" _ high:AxisValue desc:AxisDescription? {
      const body = [attr("lowTag", low), attr("highTag", high)];
      if (desc !== null && desc !== undefined) body.push(attr("description", desc));
      return {
        type: "block",
        name: "axis",
        labels: [id, name],
        body,
        span: span(location())
      };
    }
  / AxisKeyword __1 id:Identifier __1 low:AxisValue _ "->" _ high:AxisValue desc:AxisDescription? {
      const body = [attr("lowTag", low), attr("highTag", high)];
      if (desc !== null && desc !== undefined) body.push(attr("description", desc));
      return {
        type: "block",
        name: "axis",
        labels: [id],
        body,
        span: span(location())
      };
    }

TagLine
  = TagKeyword __1 id:Identifier rest:LineValueList? {
      return {
        type: "attribute",
        key: "tag",
        labels: [id],
        value: rest || { type: "array", items: [], span: span(location()) },
        span: span(location())
      };
    }

RelationshipKindLine
  = RelationshipKindKeyword __1 id:Identifier rest:LineValueList? {
      return {
        type: "attribute",
        key: "relationship_kind",
        labels: [id],
        value: rest || { type: "array", items: [], span: span(location()) },
        span: span(location())
      };
    }

SeedRelationshipLine
  = SeedRelationshipKeyword __1 kind:Identifier __1 src:Identifier __1 dst:Identifier rest:LineValueList? {
      return {
        type: "attribute",
        key: "seed_relationship",
        labels: [kind, src, dst],
        value: rest || { type: "array", items: [], span: span(location()) },
        span: span(location())
      };
    }

AxisName
  = name:String { return name; }
  / name:Identifier { return name; }

AxisValue
  = value:String { return value; }
  / value:IdentifierValue { return value; }

AxisDescription
  = __1 desc:String { return desc; }

Block
  = name:Identifier labels:Label* _ DoKeyword _ LineEnd? body:Statement* _ EndKeyword {
      return {
        type: "block",
        name,
        labels,
        body,
        span: span(location())
      };
    }

RelStatement
  = key:RelKeyword _ kind:Identifier _ src:Identifier _ "->" _ dst:Identifier values:LineValueList? {
      return {
        type: "rel",
        key,
        kind,
        src,
        dst,
        value: values || null,
        span: span(location())
      };
    }

MutateStatement
  = MutateKeyword _ target:Identifier _ id:Identifier _ op:MutateOperator _ value:Number {
      return {
        type: "mutate",
        target,
        id,
        operator: op,
        value,
        span: span(location())
      };
    }

MutateOperator
  = "+=" / "-="

PredicateStatement
  = keyword:Identifier _ field:Identifier _ subject:Identifier _ op:Comparator _ value:Number {
      return {
        type: "predicate",
        keyword,
        field,
        subject,
        operator: op,
        value,
        span: span(location())
      };
    }
  / keyword:Identifier _ subject:Identifier _ op:Comparator _ value:Number {
      return {
        type: "predicate",
        keyword,
        subject,
        operator: op,
        value,
        span: span(location())
      };
    }

Comparator
  = ">=" / "<=" / "==" / "!=" / ">" / "<"

InStatement
  = key:Identifier _ InKeyword _ list:(InlineValueList / Value) {
      const items = list.items ? list.items : [list];
      return {
        type: "in",
        key,
        items,
        span: span(location())
      };
    }

FromStatement
  = FromKeyword _ "graph" {
      return {
        type: "from",
        source: "graph",
        span: span(location())
      };
    }
  / FromKeyword _ source:Identifier _ "via" _ relationship:Identifier _ direction:Identifier {
      return {
        type: "from",
        source,
        relationship,
        direction,
        span: span(location())
      };
    }

LabeledAttribute
  = key:LabeledKey _ labels:Label+ values:LineValueList? {
      return {
        type: "attribute",
        key,
        labels,
        value: values || null,
        span: span(location())
      };
    }

LabeledKey
  = CreateKeyword
  / RelationshipKeyword
  / RelKeyword
  / VarKeyword
  / VariableKeyword
  / LetKeyword
  / ApplicabilityKeyword
  / AxisKeyword
  / EntityKindKeyword
  / RelationshipKindKeyword
  / TagKeyword
  / SeedRelationshipKeyword
  / StrategyKeyword

Label
  = _ value:(String / VariableIdentifier / QualifiedIdentifier / Identifier) { return value; }

KindSubtype
  = kind:Identifier ":" subtype:Identifier { return kind + ":" + subtype; }

Attribute
  = key:(Identifier / String) _ values:InlineValues {
      return {
        type: "attribute",
        key,
        value: values,
        labels: [],
        span: span(location())
      };
    }

BareStatement
  = value:(String / IdentifierValue) {
      return {
        type: "bare",
        value,
        span: span(location())
      };
    }

InlineValues
  = values:InlineValueList { return values; }
  / value:Value { return value; }

InlineValueList
  = head:Value tail:(__1 Value)+ {
      const rest = tail.map(t => t[1]);
      return {
        type: "array",
        items: [head, ...rest],
        span: span(location())
      };
    }

LineValueList
  = __1 head:Value tail:(__1 Value)* {
      const rest = tail.map(t => t[1]);
      return {
        type: "array",
        items: [head, ...rest],
        span: span(location())
      };
    }

Value
  = ComparatorToken
  / Call
  / Null
  / Boolean
  / Number
  / String
  / IdentifierValue

ComparatorToken
  = op:Comparator { return op; }

Call
  = name:Identifier _ "(" _ args:CallArgs? _ ")" {
      return {
        type: "call",
        name,
        args: args || [],
        span: span(location())
      };
    }

CallArgs
  = head:Value tail:(__1 Value)* {
      const rest = tail.map(t => t[1]);
      return [head, ...rest];
    }

IdentifierValue
  = id:(VariableIdentifier / QualifiedIdentifier / KindSubtype / Identifier) {
      return {
        type: "identifier",
        value: id,
        span: span(location())
      };
    }


Boolean
  = "true" WordBoundary { return true; }
  / "false" WordBoundary { return false; }

Null
  = "null" WordBoundary { return null; }

Number
  = sign:"-"? int:[0-9]+ frac:("." [0-9]+)? {
      const num = sign ? "-" + int.join("") : int.join("");
      return frac ? parseFloat(num + "." + frac[1].join("")) : parseInt(num, 10);
    }

String
  = "\"" chars:Char* "\"" { return chars.join(""); }

Char
  = "\\" escaped:EscapeSequence { return escaped; }
  / !"\"" ch:. { return ch; }

EscapeSequence
  = "\"" { return "\""; }
  / "\\" { return "\\"; }
  / "/" { return "/"; }
  / "b" { return "\b"; }
  / "f" { return "\f"; }
  / "n" { return "\n"; }
  / "r" { return "\r"; }
  / "t" { return "\t"; }

Identifier
  = !Keyword name:$([a-zA-Z_][a-zA-Z0-9_\-]*) { return name; }

QualifiedIdentifier
  = name:$([a-zA-Z_][a-zA-Z0-9_\-]* ("." [a-zA-Z_][a-zA-Z0-9_\-]*)+) { return name; }

VariableIdentifier
  = "$" [a-zA-Z_][a-zA-Z0-9_\-]* ("." [a-zA-Z_][a-zA-Z0-9_\-]*)* {
      return "$" + text().slice(1);
    }

IdentifierChar = [a-zA-Z0-9_\-]
WordBoundary = !IdentifierChar

AxisKeyword = "axis" WordBoundary { return "axis"; }
TagKeyword = "tag" WordBoundary { return "tag"; }
RelationshipKindKeyword = "relationship_kind" WordBoundary { return "relationship_kind"; }
SeedRelationshipKeyword = "seed_relationship" WordBoundary { return "seed_relationship"; }
RelKeyword = "rel" WordBoundary { return "rel"; }
  / "relationship" WordBoundary { return "relationship"; }
MutateKeyword = "mutate" WordBoundary { return "mutate"; }
InKeyword = "in" WordBoundary { return "in"; }
FromKeyword = "from" WordBoundary { return "from"; }
CreateKeyword = "create" WordBoundary { return "create"; }
RelationshipKeyword = "relationship" WordBoundary { return "relationship"; }
VarKeyword = "var" WordBoundary { return "var"; }
VariableKeyword = "variable" WordBoundary { return "variable"; }
LetKeyword = "let" WordBoundary { return "let"; }
ApplicabilityKeyword = "applicability" WordBoundary { return "applicability"; }
EntityKindKeyword = "entity_kind" WordBoundary { return "entity_kind"; }
StrategyKeyword = "strategy" WordBoundary { return "strategy"; }
DoKeyword = "do" WordBoundary { return "do"; }
EndKeyword = "end" WordBoundary { return "end"; }

Keyword
  = ("do" / "end" / "true" / "false" / "null") WordBoundary

LineEnd = _ (Newline / ";")+
Newline = "\r"? "\n"

_ = (Whitespace / Comment)*
__ = (Whitespace / Comment / Newline)*
__1 = Whitespace+
Whitespace = [ \t]+ 
Comment = "#" [^\n]* / "//" [^\n]*

`;
