ifndef ROOT_DIR
	ROOT_DIR := ..
endif
ifndef BUILD_DIR
	BUILD_DIR := $(ROOT_DIR)/build
endif

CLOSURE_FLAGS := --compilation_level WHITESPACE_ONLY --formatting PRETTY_PRINT

CLIENT_SCRIPTS := \
	$(ROOT_DIR)/node_modules/marked/lib/marked.js \
	external/json2.js \
	utilities/DOM.js \
	utilities/query.js \
	index.js

CLIENT_FILES := \
	robots.txt \
	favicon.ico \
	index.html \
	index.css \
	index.js

CLIENT_GZIPS := $(addsuffix .gz,$(CLIENT_FILES))

client: $(addprefix $(BUILD_DIR)/,$(CLIENT_FILES)) $(addprefix $(BUILD_DIR)/,$(CLIENT_GZIPS))

clean:
	-rm -rf $(BUILD_DIR)

$(BUILD_DIR)/index.js: utilities/externs.js $(CLIENT_SCRIPTS)
	-mkdir -p $(dir $@)
	java -jar $(ROOT_DIR)/deps/compiler-latest/compiler.jar $(addprefix --js=,$(filter-out $<,$^)) --js_output_file=$@ --language_in=ECMASCRIPT5 --externs $< $(CLOSURE_FLAGS) #--compilation_level ADVANCED_OPTIMIZATIONS

$(BUILD_DIR)/%.css: %.css
	-mkdir -p $(dir $@)
	cat $+ | java -jar $(ROOT_DIR)/deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css --charset utf-8 -o $@

$(BUILD_DIR)/%: %
	-mkdir -p $(dir $@)
	cp -R $< $@

$(BUILD_DIR)/%.gz: $(BUILD_DIR)/%
	-mkdir -p $(dir $@)
	gzip -nc9 $< > $@

.PHONY: client clean
