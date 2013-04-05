--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: URIs; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE "URIs" (
    "uriID" bigint NOT NULL,
    "URI" text NOT NULL,
    "entryID" bigint
);


ALTER TABLE public."URIs" OWNER TO postgres;

--
-- Name: URIs_uriID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "URIs_uriID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."URIs_uriID_seq" OWNER TO postgres;

--
-- Name: URIs_uriID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "URIs_uriID_seq" OWNED BY "URIs"."uriID";


--
-- Name: entries; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE entries (
    "entryID" bigint NOT NULL,
    hash text NOT NULL,
    type text NOT NULL,
    fulltext tsvector
);


ALTER TABLE public.entries OWNER TO postgres;

--
-- Name: entries_entryID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "entries_entryID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."entries_entryID_seq" OWNER TO postgres;

--
-- Name: entries_entryID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "entries_entryID_seq" OWNED BY entries."entryID";


--
-- Name: links; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE links (
    "linkID" bigint NOT NULL,
    "fromEntryID" bigint NOT NULL,
    "toUriID" bigint NOT NULL,
    direct boolean NOT NULL,
    indirect bigint NOT NULL
);


ALTER TABLE public.links OWNER TO postgres;

--
-- Name: links_linkID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "links_linkID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."links_linkID_seq" OWNER TO postgres;

--
-- Name: links_linkID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "links_linkID_seq" OWNED BY links."linkID";


--
-- Name: remotes; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE remotes (
    "remoteID" bigint NOT NULL,
    "remoteURL" text NOT NULL,
    query text NOT NULL
);


ALTER TABLE public.remotes OWNER TO postgres;

--
-- Name: remotes_remoteID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "remotes_remoteID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."remotes_remoteID_seq" OWNER TO postgres;

--
-- Name: remotes_remoteID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "remotes_remoteID_seq" OWNED BY remotes."remoteID";


--
-- Name: uriID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "URIs" ALTER COLUMN "uriID" SET DEFAULT nextval('"URIs_uriID_seq"'::regclass);


--
-- Name: entryID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY entries ALTER COLUMN "entryID" SET DEFAULT nextval('"entries_entryID_seq"'::regclass);


--
-- Name: linkID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY links ALTER COLUMN "linkID" SET DEFAULT nextval('"links_linkID_seq"'::regclass);


--
-- Name: remoteID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY remotes ALTER COLUMN "remoteID" SET DEFAULT nextval('"remotes_remoteID_seq"'::regclass);


--
-- Name: entryPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY entries
    ADD CONSTRAINT "entryPrimaryKey" PRIMARY KEY ("entryID");


--
-- Name: linkPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY links
    ADD CONSTRAINT "linkPrimaryKey" PRIMARY KEY ("linkID");


--
-- Name: uniqueURI; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "URIs"
    ADD CONSTRAINT "uniqueURI" UNIQUE ("URI");


--
-- Name: uriPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "URIs"
    ADD CONSTRAINT "uriPrimaryKey" PRIMARY KEY ("uriID");


--
-- Name: fulltextIndex; Type: INDEX; Schema: public; Owner: postgres; Tablespace: 
--

CREATE INDEX "fulltextIndex" ON entries USING gin (fulltext);


--
-- Name: linkEntryUriIndex; Type: INDEX; Schema: public; Owner: postgres; Tablespace: 
--

CREATE UNIQUE INDEX "linkEntryUriIndex" ON links USING btree ("fromEntryID", "toUriID");


--
-- Name: uriEntryIDIndex; Type: INDEX; Schema: public; Owner: postgres; Tablespace: 
--

CREATE UNIQUE INDEX "uriEntryIDIndex" ON "URIs" USING btree ("uriID", "entryID");


--
-- Name: uriOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "uriOnDuplicateDoNothing" AS ON INSERT TO "URIs" WHERE (EXISTS (SELECT 1 FROM "URIs" old WHERE (old."URI" = new."URI"))) DO INSTEAD NOTHING;


--
-- Name: public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

