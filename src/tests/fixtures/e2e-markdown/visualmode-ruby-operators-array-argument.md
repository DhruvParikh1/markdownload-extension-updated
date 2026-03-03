The asterisk symbol (`*`) is used with the argument of a method definition to capture remaining positional arguments into an array.

Here is an example of a method that can accept any number of (positional) arguments and then receives them as an array to process.

```ruby
def odd_finder(*items)
  items.each do |item|
    if item.odd?
      puts "Odd item: #{item}"
    end
  end
end

odd_finder(1, 2, 3, 4, 5)
# => Odd item: 1
# => Odd item: 3
# => Odd item: 5
```

### [References](https://www.visualmode.dev/ruby-operators/array-argument#references)

-   [Array/Hash Arguments | Ruby Docs ↗](https://ruby-doc.org/3.3.6/syntax/methods_rdoc.html#label-Array-2FHash+Argument)
-   [Named Rest Arguments ↗](https://dev.to/pimp_my_ruby/the-simplest-guide-on-ruby-methods-arguments-25pk#named-rest-arguments)