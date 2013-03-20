ROOT_DIR := .

.DEFAULT_GOAL := all

VPATH = client
include client/Makefile

all: client

.PHONY: all client
