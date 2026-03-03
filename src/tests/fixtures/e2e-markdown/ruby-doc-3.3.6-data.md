Class Data provides a convenient way to define simple classes for value-alike objects.

The simplest example of usage:

```csharp
Measure = Data.define(:amount, :unit)


distance = Measure.new(100, 'km')


weight = Measure.new(amount: 50, unit: 'kg')


speed = Measure[10, 'mPh']


area = Measure[amount: 1.5, unit: 'm^2']


distance.amount 
distance.unit 
```

Constructed object also has a reasonable definitions of [`==`](https://ruby-doc.org/3.3.6/Data.html#method-i-3D-3D) operator, [`to_h`](https://ruby-doc.org/3.3.6/Data.html#method-i-to_h) hash conversion, and [`deconstruct`](https://ruby-doc.org/3.3.6/Data.html#method-i-deconstruct) / [`deconstruct_keys`](https://ruby-doc.org/3.3.6/Data.html#method-i-deconstruct_keys) to be used in pattern matching.

[`::define`](https://ruby-doc.org/3.3.6/Data.html#method-c-define) method accepts an optional block and evaluates it in the context of the newly defined class. That allows to define additional methods:

```ruby
Measure = Data.define(:amount, :unit) do
  def <=>(other)
    return unless other.is_a?(self.class) && other.unit == unit
    amount <=> other.amount
  end

  include Comparable
end

Measure[3, 'm'] < Measure[5, 'm'] 
Measure[3, 'm'] < Measure[5, 'kg']

```

[`Data`](https://ruby-doc.org/3.3.6/Data.html) provides no member writers, or enumerators: it is meant to be a storage for immutable atomic values. But note that if some of data members is of a mutable class, [`Data`](https://ruby-doc.org/3.3.6/Data.html) does no additional immutability enforcement:

```vbnet
Event = Data.define(:time, :weekdays)
event = Event.new('18:00', %w[Tue Wed Fri])


event.weekdays << 'Sat'
event

```

See also [`Struct`](https://ruby-doc.org/3.3.6/Struct.html), which is a similar concept, but has more container-alike API, allowing to change contents of the object and enumerate it.

### Public Class Methods

define(\*symbols) → class

Defines a new Data class.

```ruby
measure = Data.define(:amount, :unit)

measure.new(1, 'km')


Measure = Data.define(:amount, :unit)

Measure.new(1, 'km')

```

Note that member-less Data is acceptable and might be a useful technique for defining several homogenous data classes, like

```ruby
class HTTPFetcher
  Response = Data.define(:body)
  NotFound = Data.define

end
```

Now, different kinds of responses from `HTTPFetcher` would have consistent representation:

And are convenient to use in pattern matching:

```ruby
case fetcher.get(url)
in HTTPFetcher::Response(body)

in HTTPFetcher::NotFound

end
```

```java
static VALUE
rb_data_s_def(int argc, VALUE *argv, VALUE klass)
{
    VALUE rest;
    long i;
    VALUE data_class;

    rest = rb_ident_hash_new();
    RBASIC_CLEAR_CLASS(rest);
    for (i=0; i<argc; i++) {
        VALUE mem = rb_to_symbol(argv[i]);
        if (rb_is_attrset_sym(mem)) {
            rb_raise(rb_eArgError, "invalid data member: %"PRIsVALUE, mem);
        }
        if (RTEST(rb_hash_has_key(rest, mem))) {
            rb_raise(rb_eArgError, "duplicate member: %"PRIsVALUE, mem);
        }
        rb_hash_aset(rest, mem, Qtrue);
    }
    rest = rb_hash_keys(rest);
    RBASIC_CLEAR_CLASS(rest);
    OBJ_FREEZE_RAW(rest);
    data_class = anonymous_struct(klass);
    setup_data(data_class, rest);
    if (rb_block_given_p()) {
        rb_mod_module_eval(0, 0, data_class);
    }

    return data_class;
}
```

DataClass::members → array\_of\_symbols

Returns an array of member names of the data class:

```makefile
Measure = Data.define(:amount, :unit)
Measure.members 
```

```cpp
#define rb_data_s_members_m rb_struct_s_members_m
```

new(\*args) → instance

new(\*\*kwargs) → instance

::\[\](\*args) → instance

::\[\](\*\*kwargs) → instance

Constructors for classes defined with [`::define`](https://ruby-doc.org/3.3.6/Data.html#method-c-define) accept both positional and keyword arguments.

```csharp
Measure = Data.define(:amount, :unit)

Measure.new(1, 'km')

Measure.new(amount: 1, unit: 'km')


Measure[1, 'km']

Measure[amount: 1, unit: 'km']

```

All arguments are mandatory (unlike [`Struct`](https://ruby-doc.org/3.3.6/Struct.html)), and converted to keyword arguments:

```csharp
Measure.new(amount: 1)


Measure.new(1)

```

Note that `Measure#initialize` always receives keyword arguments, and that mandatory arguments are checked in `initialize`, not in `new`. This can be important for redefining initialize in order to convert arguments or provide defaults:

```php
Measure = Data.define(:amount, :unit) do
  NONE = Data.define

  def initialize(amount:, unit: NONE.new)
    super(amount: Float(amount), unit:)
  end
end

Measure.new('10', 'km') 
Measure.new(10_000)     
```

```objectivec
static VALUE
rb_data_initialize_m(int argc, const VALUE *argv, VALUE self)
{
    VALUE klass = rb_obj_class(self);
    rb_struct_modify(self);
    VALUE members = struct_ivar_get(klass, id_members);
    size_t num_members = RARRAY_LEN(members);

    if (argc == 0) {
        if (num_members > 0) {
            rb_exc_raise(rb_keyword_error_new("missing", members));
        }
        return Qnil;
    }
    if (argc > 1 || !RB_TYPE_P(argv[0], T_HASH)) {
        rb_error_arity(argc, 0, 0);
    }

    if (RHASH_SIZE(argv[0]) < num_members) {
        VALUE missing = rb_ary_diff(members, rb_hash_keys(argv[0]));
        rb_exc_raise(rb_keyword_error_new("missing", missing));
    }

    struct struct_hash_set_arg arg;
    rb_mem_clear((VALUE *)RSTRUCT_CONST_PTR(self), num_members);
    arg.self = self;
    arg.unknown_keywords = Qnil;
    rb_hash_foreach(argv[0], struct_hash_set_i, (VALUE)&arg);
    // Freeze early before potentially raising, so that we don't leave an
    // unfrozen copy on the heap, which could get exposed via ObjectSpace.
    OBJ_FREEZE_RAW(self);
    if (arg.unknown_keywords != Qnil) {
        rb_exc_raise(rb_keyword_error_new("unknown", arg.unknown_keywords));
    }
    return Qnil;
}
```

### Public Instance Methods

self == other → true or false

Returns `true` if `other` is the same class as `self`, and all members are equal.

Examples:

```ruby
Measure = Data.define(:amount, :unit)

Measure[1, 'km'] == Measure[1, 'km'] 
Measure[1, 'km'] == Measure[2, 'km'] 
Measure[1, 'km'] == Measure[1, 'm']  

Measurement = Data.define(:amount, :unit)


Measure[1, 'km'] == Measurement[1, 'km'] 
```

```cpp
#define rb_data_equal rb_struct_equal
```

deconstruct → array

Returns the values in `self` as an array, to use in pattern matching:

```ruby
Measure = Data.define(:amount, :unit)

distance = Measure[10, 'km']
distance.deconstruct 


case distance
in n, 'km' 
  puts "It is #{n} kilometers away"
else
  puts "Don't know how to handle it"
end

```

Or, with checking the class, too:

```ruby
case distance
in Measure(n, 'km')
  puts "It is #{n} kilometers away"

end
```

```cpp
#define rb_data_deconstruct rb_struct_to_a
```

deconstruct\_keys(array\_of\_names\_or\_nil) → hash

Returns a hash of the name/value pairs, to use in pattern matching.

```ruby
Measure = Data.define(:amount, :unit)

distance = Measure[10, 'km']
distance.deconstruct_keys(nil) 
distance.deconstruct_keys([:amount]) 


case distance
in amount:, unit: 'km' 
  puts "It is #{amount} kilometers away"
else
  puts "Don't know how to handle it"
end

```

Or, with checking the class, too:

```php
case distance
in Measure(amount:, unit: 'km')
  puts "It is #{amount} kilometers away"

end
```

```cpp
#define rb_data_deconstruct_keys rb_struct_deconstruct_keys
```

eql?(other) → true or false

Equality check that is used when two items of data are keys of a [`Hash`](https://ruby-doc.org/3.3.6/Hash.html).

The subtle difference with [`==`](https://ruby-doc.org/3.3.6/Data.html#method-i-3D-3D) is that members are also compared with their [`eql?`](https://ruby-doc.org/3.3.6/Data.html#method-i-eql-3F) method, which might be important in some cases:

```ruby
Measure = Data.define(:amount, :unit)

Measure[1, 'km'] == Measure[1.0, 'km'] 

Measure[1, 'km'].eql? Measure[1.0, 'km'] 
```

See also [`Object#eql?`](https://ruby-doc.org/3.3.6/Object.html#method-i-eql-3F) for further explanations of the method usage.

```cpp
#define rb_data_eql rb_struct_eql
```

hash → integer

Redefines [`Object#hash`](https://ruby-doc.org/3.3.6/Object.html#method-i-hash) (used to distinguish objects as [`Hash`](https://ruby-doc.org/3.3.6/Hash.html) keys) so that data objects of the same class with same content would have the same `hash` value, and represented the same [`Hash`](https://ruby-doc.org/3.3.6/Hash.html) key.

```bash
Measure = Data.define(:amount, :unit)

Measure[1, 'km'].hash == Measure[1, 'km'].hash 
Measure[1, 'km'].hash == Measure[10, 'km'].hash 
Measure[1, 'km'].hash == Measure[1, 'm'].hash 
Measure[1, 'km'].hash == Measure[1.0, 'km'].hash 


Measurement = Data.define(:amount, :unit)

Measure[1, 'km'].hash == Measurement[1, 'km'].hash 
```

```cpp
#define rb_data_hash rb_struct_hash
```

inspect → string

Returns a string representation of `self`:

```makefile
Measure = Data.define(:amount, :unit)

distance = Measure[10, 'km']

p distance  


puts distance  

```

```javascript
static VALUE
rb_data_inspect(VALUE s)
{
    return rb_exec_recursive(inspect_struct, s, rb_str_new2("#<data "));
}
```

Also aliased as: [to\_s](https://ruby-doc.org/3.3.6/Data.html#method-i-to_s)

members → array\_of\_symbols

Returns the member names from `self` as an array:

```makefile
Measure = Data.define(:amount, :unit)
distance = Measure[10, 'km']

distance.members 
```

```cpp
#define rb_data_members_m rb_struct_members_m
```

to\_h → hash

to\_h {|name, value| ... } → hash

Returns [`Hash`](https://ruby-doc.org/3.3.6/Hash.html) representation of the data object.

```makefile
Measure = Data.define(:amount, :unit)
distance = Measure[10, 'km']

distance.to_h

```

Like [`Enumerable#to_h`](https://ruby-doc.org/3.3.6/Enumerable.html#method-i-to_h), if the block is provided, it is expected to produce key-value pairs to construct a hash:

```kotlin
distance.to_h { |name, val| [name.to_s, val.to_s] }

```

Note that there is a useful symmetry between [`to_h`](https://ruby-doc.org/3.3.6/Data.html#method-i-to_h) and initialize:

```ini
distance2 = Measure.new(**distance.to_h)

distance2 == distance

```

```cpp
#define rb_data_to_h rb_struct_to_h
```

to\_s → string

Returns a string representation of `self`:

```makefile
Measure = Data.define(:amount, :unit)

distance = Measure[10, 'km']

p distance  


puts distance  

```

with(\*\*kwargs) → instance

Returns a shallow copy of `self` — the instance variables of `self` are copied, but not the objects they reference.

If the method is supplied any keyword arguments, the copy will be created with the respective field values updated to use the supplied keyword argument values. Note that it is an error to supply a keyword that the [`Data`](https://ruby-doc.org/3.3.6/Data.html) class does not have as a member.

```makefile
Point = Data.define(:x, :y)

origin = Point.new(x: 0, y: 0)

up = origin.with(x: 1)
right = origin.with(y: 1)
up_and_right = up.with(y: 1)

p origin       
p up           
p right        
p up_and_right 

out = origin.with(z: 1) 
some_point = origin.with(1, 2) 
```

```objectivec
static VALUE
rb_data_with(int argc, const VALUE *argv, VALUE self)
{
    VALUE kwargs;
    rb_scan_args(argc, argv, "0:", &kwargs);
    if (NIL_P(kwargs)) {
        return self;
    }

    VALUE h = rb_struct_to_h(self);
    rb_hash_update_by(h, kwargs, 0);
    return rb_class_new_instance_kw(1, &h, rb_obj_class(self), TRUE);
}
```