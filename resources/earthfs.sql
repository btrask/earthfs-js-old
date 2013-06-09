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
    "userID" bigint NOT NULL,
    targets text NOT NULL,
    "remoteURL" text NOT NULL,
    query text NOT NULL,
    username text,
    password text
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
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE sessions (
    "sessionID" bigint NOT NULL,
    "sessionHash" text NOT NULL,
    "userID" bigint NOT NULL,
    "modeRead" boolean NOT NULL,
    "modeWrite" boolean NOT NULL,
    "sessionTime" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: sessions_sessionID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "sessions_sessionID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."sessions_sessionID_seq" OWNER TO postgres;

--
-- Name: sessions_sessionID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "sessions_sessionID_seq" OWNED BY sessions."sessionID";


--
-- Name: sources; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE sources (
    "sourceID" bigint NOT NULL,
    "entryID" bigint NOT NULL,
    "userID" bigint NOT NULL,
    "submissionTime" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sources OWNER TO postgres;

--
-- Name: sources_sourceID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "sources_sourceID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."sources_sourceID_seq" OWNER TO postgres;

--
-- Name: sources_sourceID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "sources_sourceID_seq" OWNED BY sources."sourceID";


--
-- Name: targets; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE targets (
    "targetID" bigint NOT NULL,
    "entryID" bigint NOT NULL,
    "userID" bigint,
    "sourceID" bigint NOT NULL
);


ALTER TABLE public.targets OWNER TO postgres;

--
-- Name: targets_targetID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "targets_targetID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."targets_targetID_seq" OWNER TO postgres;

--
-- Name: targets_targetID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "targets_targetID_seq" OWNED BY targets."targetID";


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE users (
    "userID" bigint NOT NULL,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    "tokenHash" text NOT NULL,
    cert text,
    key text,
    "userTime" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "usernameNotPublic" CHECK ((username <> 'public'::text))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_userID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "users_userID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."users_userID_seq" OWNER TO postgres;

--
-- Name: users_userID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "users_userID_seq" OWNED BY users."userID";


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
-- Name: sessionID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY sessions ALTER COLUMN "sessionID" SET DEFAULT nextval('"sessions_sessionID_seq"'::regclass);


--
-- Name: sourceID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY sources ALTER COLUMN "sourceID" SET DEFAULT nextval('"sources_sourceID_seq"'::regclass);


--
-- Name: targetID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY targets ALTER COLUMN "targetID" SET DEFAULT nextval('"targets_targetID_seq"'::regclass);


--
-- Name: userID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY users ALTER COLUMN "userID" SET DEFAULT nextval('"users_userID_seq"'::regclass);


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
-- Name: remotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY remotes
    ADD CONSTRAINT remotes_pkey PRIMARY KEY ("remoteID");


--
-- Name: sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY ("sessionID");


--
-- Name: sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY sources
    ADD CONSTRAINT sources_pkey PRIMARY KEY ("sourceID");


--
-- Name: targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY targets
    ADD CONSTRAINT targets_pkey PRIMARY KEY ("targetID");


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
-- Name: usersUniqueName; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY users
    ADD CONSTRAINT "usersUniqueName" UNIQUE (username);


--
-- Name: users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY ("userID");


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

