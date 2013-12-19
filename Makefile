ROOT_DIR := .

.DEFAULT_GOAL := all

include client/Makefile

all: client

.PHONY: all client
