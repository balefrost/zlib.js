define(function() {
	var fixed_patterns = {
		"000": { bits: 4, base: 256 },
		"0010": { bits: 3, base: 272 },
		"0011": { bits: 4, base: 0 },
		"01": { bits: 6, base: 16 },
		"10": { bits: 6, base: 80 },
		"11000": { bits: 3, base: 280 },
		"11001": { bits: 4, base: 144 },
		"1101": { bits: 5, base: 160 },
		"111": { bits: 6, base: 192 }
	};

	var fixed_tree = build_tree_from_patterns(fixed_patterns);

	var length_symbol_to_parse_instructions = [
		{ bits: 0, base:   3 },
		{ bits: 0, base:   4 },
		{ bits: 0, base:   5 },
		{ bits: 0, base:   6 },
		{ bits: 0, base:   7 },
		{ bits: 0, base:   8 },
		{ bits: 0, base:   9 },
		{ bits: 0, base:  10 },
		{ bits: 1, base:  11 },
		{ bits: 1, base:  13 },
		{ bits: 1, base:  15 },
		{ bits: 1, base:  17 },
		{ bits: 2, base:  19 },
		{ bits: 2, base:  23 },
		{ bits: 2, base:  27 },
		{ bits: 2, base:  31 },
		{ bits: 3, base:  35 },
		{ bits: 3, base:  43 },
		{ bits: 3, base:  51 },
		{ bits: 3, base:  59 },
		{ bits: 4, base:  67 },
		{ bits: 4, base:  83 },
		{ bits: 4, base:  99 },
		{ bits: 4, base: 115 },
		{ bits: 5, base: 131 },
		{ bits: 5, base: 163 },
		{ bits: 5, base: 195 },
		{ bits: 5, base: 227 },
		{ bits: 0, base: 258 }
	];

	var distance_symbol_to_parse_instructions = [
		{ bits: 0, base: 1 },
		{ bits: 0, base: 2 },
		{ bits: 0, base: 3 },
		{ bits: 0, base: 4 },
		{ bits: 1, base: 5 },
		{ bits: 1, base: 7 },
		{ bits: 2, base: 9 },
		{ bits: 2, base: 13 },
		{ bits: 3, base: 17 },
		{ bits: 3, base: 25 },
		{ bits: 4, base: 33 },
		{ bits: 4, base: 49 },
		{ bits: 5, base: 65 },
		{ bits: 5, base: 97 },
		{ bits: 6, base: 129 },
		{ bits: 6, base: 193 },
		{ bits: 7, base: 257 },
		{ bits: 7, base: 385 },
		{ bits: 8, base: 513 },
		{ bits: 8, base: 769 },
		{ bits: 9, base: 1025 },
		{ bits: 9, base: 1537 },
		{ bits: 10, base: 2049 },
		{ bits: 10, base: 3073 },
		{ bits: 11, base: 4097 },
		{ bits: 11, base: 6145 },
		{ bits: 12, base: 8193 },
		{ bits: 12, base: 12289 },
		{ bits: 13, base: 16385 },
		{ bits: 13, base: 24577 }
	];

	function build_tree_from_patterns(patterns) {
		var root = {};
		for (var k in patterns) {
			if (patterns.hasOwnProperty(k)) {
				var current_tree = root;
				for (var i = 0; i < k.length - 1; ++i) {
					var char = k.charAt(i);
					if (current_tree.hasOwnProperty(char)) {
						current_tree = current_tree[char]
					} else {
						var subtree = {};
						current_tree[char] = subtree;
						current_tree = subtree;
					}
				}
				var lastChar = k.charAt(k.length - 1);
				if (current_tree.hasOwnProperty(lastChar)) {
					throw "Tree already has prefix " + k;
				} else {
					var t = patterns[k];
					current_tree[lastChar] = { terminal: true, bits: t.bits, base: t.base };
				}
			}
		}
		return root;
	}

	function output_byte_array() {
		var buf = new Uint8Array(1);
		var idx = 0;
	
		function resize(newSize) {
			var oldBuf = buf;
			buf = new Uint8Array(newSize);
			for (var i = 0; i < idx; ++i) {
				buf[i] = oldBuf[i];
			}
		}
	
		this.ensure = function(desiredSize) {
			var proposedSize = buf.length;
			if (desiredSize > proposedSize) {
				while (desiredSize > proposedSize) {
					proposedSize = proposedSize * 2;
				}
				resize(proposedSize);
			}
		}
	
		this.push = function(bytes$varargs) {
			this.ensure(idx + arguments.length);
			for (var i = 0; i < arguments.length; ++i) {
				buf[idx] = arguments[i];
				++idx;
			}
		}
	
		this.slice = function(startIdx, endIdx$opt) {
			if (endIdx$opt === undefined) {
				return new Uint8Array(buf.buffer, startIdx);
			} else {
				return new Uint8Array(buf.buffer, startIdx, endIdx$opt - startIdx);
			}
		}
	}

	function deflate(buf) {
		var currentByte = 0;
		var currentBit = 0;
	
		function bit() {
			var data = (buf.getUint8(currentByte) >> currentBit) & 0x01;
		
			++currentBit;
			while (currentBit >= 8) {
				currentBit -= 8;
				currentByte += 1;
			}
			return data;
		}
	
		function bits(n) {
			var result = 0;
			for (var i = 0; i < n; ++i) {
				result = (bit() << i) | result;
			}
			return result;
		}
	
		function uint8() {
			var result = buf.getUint8(currentByte);
			++currentByte;
			return result;
		}

		function uint16() {
			var result = buf.getUint16(currentByte, true);
			currentByte += 2;
			return result;
		}
	
		function parse_symbol_using_tree(tree) {
			var current_tree = tree;

			while (!current_tree.terminal) {
				var b = bit();
				current_tree = current_tree[b == 1 ? "1" : "0"];
			}
		
			var offset = 0;
			for (var i = 0; i < current_tree.bits; ++i) {
				var b = bit();
				offset = (offset << 1) + b;
			}
	
			return current_tree.base + offset;
		}
	
		function push_output_byte(b) {
			// if (output_bytes.length === 5242) {
			// 	throw "this is the bad byte";
			// }
			output_bytes.push(b);
		}
	
		function parse_length_and_distance(length_symbol, parse_distance_symbol) {
			var length_spec = length_symbol_to_parse_instructions[length_symbol - 257];
			var length = bits(length_spec.bits) + length_spec.base;
			var distance_symbol = parse_distance_symbol();
			var distance_spec = distance_symbol_to_parse_instructions[distance_symbol];
			var distance = bits(distance_spec.bits) + distance_spec.base;
			var starting_index = output_bytes.length - distance;
			for (var i = 0; i < length; ++i) {
				push_output_byte(output_bytes[starting_index + i]);
			}
		}

		var output_bytes = [];
		var bfinal;
		do {
			bfinal = bit() === 1 ? true : false;
			var btype = bits(2);
	
			// if (btype === 0) {
			// 	//advance to next full byte
			// 	console.log("currentByte", currentByte, "->", currentByte + 1);
			// 	console.log("currentBit", currentBit, "->", 7);
			// 	currentBit = 7;
			// 	++currentByte;
			// 	
			// 	console.log(buf.getUint8(currentByte), buf.getUint8(currentByte + 1), buf.getUint8(currentByte + 2), buf.getUint8(currentByte + 3));
			// 	var len = uint16();
			// 	var nlen = uint16();
			// 	
			// 	console.log("len", len);
			// 	console.log("nlen", nlen);
	
			if (btype === 1) {
				var symbol;
				do {
					var symbol = parse_symbol_using_tree(fixed_tree);
				
					if (isNaN(symbol)) {
						throw "NaN";
					}

					if (symbol > 256) {
						parse_length_and_distance(symbol, function() {
							return bits(5);
						});
					}

					if (symbol < 256) {
						push_output_byte(symbol);
					}
		
				} while (symbol !== 256)
			} else if (btype === 2) {
				var numLiterals = bits(5) + 257;
				var numDistances = bits(5) + 1;
				var numCodeLengths = bits(4) + 4;
			
				var codeLengthOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
				var codeLengthCounts = new Array(codeLengthOrder.length);
				for (var i = 0; i < codeLengthCounts.length; ++i) {
					codeLengthCounts[i] = 0;
				}
			
				for (var i = 0; i < numCodeLengths; ++i) {
					codeLengthCounts[codeLengthOrder[i]] = bits(3);
				}
			
				var codes = bit_lengths_to_codes(codeLengthCounts);
			
				//todo: consider trying to optimize the tree (it's possible, though unlikely, that sequential symbols will get sequential, aligned codes)
				var patterns = {};
				codes.forEach(function(code, i) { 
					if (code !== undefined) {
						patterns[code] = {
							base: i,
							bits: 0
						};
					}
				});
			
				var tree = build_tree_from_patterns(patterns);
			
				function read_according_to_code_lengths(num) {
					var result = [];
					while (result.length < num) {
						var symbol = parse_symbol_using_tree(tree);
						if (symbol >= 0 && symbol <= 15) {
							result.push(symbol);
						} else if (symbol === 16) {
							var reps = bits(2) + 3;
							var toCopy = result[result.length - 1];
							for (var i = 0; i < reps; ++i) {
								result.push(toCopy);
							}
						} else if (symbol === 17) {
							var reps = bits(3) + 3;
							for (var i = 0; i < reps; ++i) {
								result.push(0);
							}
						} else if (symbol === 18) {
							var reps = bits(7) + 11;
							for (var i = 0; i < reps; ++i) {
								result.push(0);
							}
						} else {
							throw "unexpected literal/length value";
						}
					}
					if (result.length !== num) {
						throw "incorrect number of code length items";
					}
					return result;
				}
			
				var literal_and_distance_bit_lengths = read_according_to_code_lengths(numLiterals + numDistances);
				var literal_bit_lengths = literal_and_distance_bit_lengths.slice(0, numLiterals);
				var distance_bit_lengths = literal_and_distance_bit_lengths.slice(numLiterals);

				var literal_codes = bit_lengths_to_codes(literal_bit_lengths);
				var literal_patterns = {};
				literal_codes.forEach(function(code, i) {
					if (code !== undefined) {
						literal_patterns[code] = {
							base: i,
							bits: 0
						}
					}
				});
				var distance_codes = bit_lengths_to_codes(distance_bit_lengths);
				var distance_patterns = {};
				distance_codes.forEach(function(code, i) {
					if (code !== undefined) {
						distance_patterns[code] = {
							base: i,
							bits: 0
						}
					}
				});
			
				var literal_tree = build_tree_from_patterns(literal_patterns);
				var distance_tree = build_tree_from_patterns(distance_patterns);

				var symbol;
				do {
					symbol = parse_symbol_using_tree(literal_tree);
				
					if (isNaN(symbol)) {
						throw "NaN";
					}

					if (symbol > 256) {
						parse_length_and_distance(symbol, function() {
							return parse_symbol_using_tree(distance_tree);
						});
					}

					if (symbol < 256) {
						push_output_byte(symbol);
					}
				} while (symbol !== 256)
			} else {
				throw "unsupported btype " + btype;
			}
		} while (!bfinal);
	
		return new Uint8Array(output_bytes);
	}

	function decompress_zlib(view) {
		var cmf = view.getUint8(0);
		var compression_method = cmf & 0x0f;
		var compression_info = cmf >> 4;
		var flags = view.getUint8(1);
		var fcheck = flags & 0x1f;
		var fdict = (flags >> 5) & 0x01;
		var flevel = flags >> 6;
	
		if ((cmf * 256 + flags) % 31 !== 0) {
			throw "invalud fcheck " + fcheck;
		}
	
		if (fdict !== 0) {
			throw "doesn't yet support fdict";
		}
	
		if (compression_method === 8) {
			var subView = new DataView(view.buffer, view.byteOffset + 2, view.byteLength - 6);
			return deflate(subView);
		
		} else {
			throw "invalid compression method " + compression_method;
		}
	}

	function bit_length(i) {
		if (i < 0) {
			throw "can't handle negative values";
		}
		for (var length = 0; i != 0; ++length) {
			i = i >> 1;
		}
		return length;
	}

	function count_int_array(a) {
		var result = [];
		a.forEach(function(i) {
			if (i < 0) {
				throw "can't handle negative values";
			}
		
			while (i > result.length - 1) {
				result.push(0);
			}
		
			result[i] = result[i] + 1;
		});

		return result;
	}

	function to_binary_string(number, length) {
		var str = "";
		var blength = bit_length(number);
		var i = 0;
	
		for (; i < blength; ++i) {
			str = (number & 0x01 === 1 ? "1" : "0") + str;
			number = number >> 1;
		}
	
		for (; i < length; ++i) {
			str = "0" + str;
		}
	
		return str;
	}

	function bit_lengths_to_codes(lengths) {
		var number_each_length = count_int_array(lengths);
		//ignore items with 0 bit length - these symbols are not used, and do not contribute to code construction
		number_each_length[0] = 0;
		var max_length = number_each_length.length - 1;
	
		var next_code = new Array(number_each_length.length);
		next_code[0] = 0;
		for (var bits = 1; bits <= max_length; ++bits) {
			var first = (next_code[bits - 1] + number_each_length[bits - 1]) << 1;
			var last = first + number_each_length[bits] - 1;
			if (number_each_length[bits] > 0 && bit_length(last) > bits) {
				throw "not enough slots for " + bits + " bit codes";
			}
			next_code[bits] = first;
		}
	
		var codes = new Array(lengths.length);
		lengths.forEach(function(length, i) {
			if (length !== 0) {
				var code = next_code[length];
				codes[i] = to_binary_string(code, length);
				next_code[length]++;
			}
		});
	
		return codes;
	}

	function parallel_sort(arrays$varargs, f) {
		var arrays = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
		var clones = arrays.map(function(arr) { return arr.slice(0); });
		f = arguments[arguments.length - 1];
	
		var longest = arrays.reduce(function(acc, arr) {
			return Math.max(acc, arr.length);
		}, 0)

		var sortedIndices = new Array(longest);
		for (var i = 0; i < longest; ++i) {
			sortedIndices[i] = i;
		}
	
		sortedIndices.sort(function(left, right) {
			var leftParams = arrays.map(function(arr) {
				return arr[left];
			});
		
			var rightParams = arrays.map(function(arr) {
				return arr[right];
			});
		
			return f(leftParams, rightParams);
		});
	
		arrays.forEach(function(arr, arrIdx) {
			var clone = clones[arrIdx];
			sortedIndices.forEach(function(ptr, i) {
				arr[i] = clone[ptr];
			});
		});
	}

	function zip(arrays$varargs) {
		var lengths = Array.prototype.map.call(arguments, function(a) { return a.length; });
		var shortest_length = lengths.reduce(function(a, b) { return Math.min(a, b); });
		var result = new Array(shortest_length);
		for (var i = 0; i < shortest_length; ++i) {
			var row = new Array(arguments.length);
			for (var j = 0; j < arguments.length; ++j) {
				row[j] = arguments[j][i];
			}
			result[i] = row;
		}
		return result;
	}


	function times(val, t) {
		var result = [];
		for (var i = 0; i < t; ++i) {
			result.push(val);
		}
		return result;
	}

	function flatten(as) {
		var result = [];
		as.forEach(function(a) {
			result.push.apply(result, a);
		});
		return result;
	}
	
	return {
		decomp_zlib: decompress_zlib,
		decomp_deflate: deflate
	}
});
