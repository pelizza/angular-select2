angular.module("rt.select2", [])
    .value("select2Config", {})
    .directive("select2", function ($rootScope, $timeout, $parse, $filter, select2Config) {
        "use strict";

        var filter = $filter("filter");

        function sortedKeys(obj) {
            var keys = [];
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys.push(key);
                }
            }
            return keys.sort();
        }

        var defaultOptions = {};
                               //0000111110000000000022220000000000000000000000333300000000000000444444444444444000000000555555555555555000000066666666666666600000000000000007777000000000000000000088888
        var NG_OPTIONS_REGEXP = /^\s*(.*?)(?:\s+as\s+(.*?))?(?:\s+group\s+by\s+(.*))?\s+for\s+(?:([\$\w][\$\w]*)|(?:\(\s*([\$\w][\$\w]*)\s*,\s*([\$\w][\$\w]*)\s*\)))\s+in\s+(.*?)(?:\s+track\s+by\s+(.*?))?$/;

        if (select2Config) {
            angular.extend(defaultOptions, select2Config);
        }

        return {
            require: "ngModel",
            priority: 1,
            restrict: "E",
            template: "<input type=\"hidden\"></input>",
            replace: true,
            link: function (scope, element, attrs, controller) {
                var AJS = window.AJS || {}; // jshint ignore:line
                if ((typeof AJS.$ === "function") && (typeof AJS.$().auiSelect2 === "function")) {
                    element = AJS.$("#" + element.attr("id"));
                    element.select2 = AJS.$().auiSelect2;
                }

                var getOptions;

                var opts = angular.extend({}, defaultOptions, scope.$eval(attrs.options));
                if (attrs.emptyItem) {
                    opts.emptyItem = {
                        id: "EMPTY_ITEM",
                        text: attrs.emptyItem
                    };
                }
                var isMultiple = angular.isDefined(attrs.multiple) || opts.multiple;

                opts.multiple = isMultiple;

                if (attrs.placeholder) {
                    opts.placeholder = attrs.placeholder;
                }

                var modelFn = $parse(attrs.ngModel);

                var filterOptions = $parse(attrs.optionsFilter);

                // All values returned from Select2 are strings. This is a
                // problem if you supply integer indexes: they'll become
                // strings once passing through this directive. We keep a
                // mapping between string keys and values through the
                // optionItems object, to be able to return the correctly typed
                // value.
                var optionItems = {};

                function filterValues(values) {
                    if (filterOptions) {
                        var filterParams = filterOptions(scope);
                        if (filterParams) {
                            return filter(values, filterParams);
                        }
                    }

                    return values;
                }

                if (attrs.ngOptions) {
                    var match;
                    if (!(match = attrs.ngOptions.match(NG_OPTIONS_REGEXP))) {
                        throw new Error("Invalid ngOptions encountered!");
                    }

                    var displayFn = $parse(match[2] || match[1]);
                    var valuesFn = $parse(match[7]);
                    var valueName = match[4] || match[6];
                    var valueFn = $parse(match[2] ? match[1] : valueName);
                    var keyName = match[5];

                    getOptions = function (callback) {
                        var values = filterValues(valuesFn(scope));
                        var keys = (keyName ? sortedKeys(values) : values) || [];

                        var options = [];
                        if (opts.emptyItem) {
                            optionItems[opts.emptyItem.id] = opts.emptyItem;
                            options.push(opts.emptyItem);
                        }
                        for (var i = 0; i < keys.length; i++) {
                            var locals = {};
                            var key = i;
                            if (keyName) {
                                key = keys[i];
                                locals[keyName] = key;
                            }
                            locals[valueName] = values[key];

                            var value = valueFn(scope, locals);
                            var label = displayFn(scope, locals) || "";

                            // Select2 returns strings, we use a dictionary to get
                            // back to the original value.
                            optionItems[value] = {
                                id: value,
                                text: label,
                                obj: values[key]
                            };

                            options.push(optionItems[value]);
                        }

                        callback(options);
                    };

                    opts.query = function (query) {
                        var values = filterValues(valuesFn(scope));
                        var keys = (keyName ? sortedKeys(values) : values) || [];

                        var options = [];
                        if (query.term === "" && opts.emptyItem) {
                            options.push(opts.emptyItem);
                        }
                        for (var i = 0; i < keys.length; i++) {
                            var locals = {};
                            var key = i;
                            if (keyName) {
                                key = keys[i];
                                locals[keyName] = key;
                            }
                            locals[valueName] = values[key];

                            var value = valueFn(scope, locals);
                            var label = displayFn(scope, locals) || "";

                            if (label.toLowerCase().indexOf(query.term.toLowerCase()) > -1) {
                                options.push({
                                    id: value,
                                    text: label,
                                    obj: values[key]
                                });
                            }
                        }

                        query.callback({
                            results: options
                        });
                    };

                    // Make sure changes to the options get filled in
                    scope.$watch(match[7], function () {
                        controller.$render();
                    });
                } else {
                    if (!opts.query) {
                        throw new Error("You need to supply a query function!");
                    }

                    var queryFn = opts.query;
                    opts.query = function (query) {
                        var cb = query.callback;
                        query.callback = function (data) {
                            for (var i = 0; i < data.results.length; i++) {
                                var result = data.results[i];
                                optionItems[result.id] = result;
                            }
                            cb(data);
                        };
                        queryFn(query);
                    };

                    getOptions = function (callback) {
                        opts.query({
                            term: "",
                            callback: function (query) {
                                callback(query.results);
                            }
                        });
                    };
                }

                function getSelection(callback) {
                    if (isMultiple) {
                        getOptions(function (options) {
                            var selection = [];
                            for (var i = 0; i < options.length; i++) {
                                var option = options[i];
                                var viewValue = controller.$viewValue || [];
                                if (viewValue.indexOf(option.id) > -1) {
                                    selection.push(option);
                                }
                            }
                            callback(selection);
                        });
                    } else {
                        getOptions(function () {
                            if (opts.emptyItem && !controller.$viewValue) {
                                callback(opts.emptyItem);
                            } else {
                                callback(optionItems[controller.$viewValue] || { obj: {} });
                            }
                        });
                    }
                }

                controller.$render = function () {
                    getSelection(function (selection) {
                        if (isMultiple) {
                            element.select2("data", selection);
                        } else {
                            element.select2("val", selection.id);
                        }
                    });
                };

                if (!opts.initSelection) {
                    opts.initSelection = function (element, callback) {
                        getSelection(callback);
                    };
                } else {
                    var _initSelection = opts.initSelection;
                    opts.initSelection = function (element, callback) {
                        _initSelection(element, function (result) {
                            optionItems[result.id] = result;
                            callback(result);
                        });
                    };
                }

                $timeout(function () {
                    element.select2(opts);
                    element.on("change", function (e) {
                        scope.$apply(function () {
                            var val;
                            if (isMultiple) {
                                var vals = [];
                                for (var i = 0; i < e.val.length; i++) {
                                    val = optionItems[e.val[i]];
                                    if (val) {
                                        vals.push(val.id);
                                    }
                                }
                                modelFn.assign(scope, vals);
                            } else {
                                if (opts.emptyItem && e.val === opts.emptyItem.id) {
                                    modelFn.assign(scope, null);
                                } else {
                                    val = optionItems[e.val];
                                    modelFn.assign(scope, val ? val.id : null);
                                }
                            }
                        });
                    });
                    controller.$render();
                });
            }
        };
    });
