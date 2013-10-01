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
    "URIID" bigint NOT NULL,
    "normalizedURI" text NOT NULL
);


ALTER TABLE public."URIs" OWNER TO postgres;

--
-- Name: URIs_URIID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "URIs_URIID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."URIs_URIID_seq" OWNER TO postgres;

--
-- Name: URIs_URIID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "URIs_URIID_seq" OWNED BY "URIs"."URIID";


--
-- Name: fieldLinks; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE "fieldLinks" (
    "fieldLinkID" bigint NOT NULL,
    "fieldID" bigint NOT NULL,
    "URIID" bigint NOT NULL,
    relation text NOT NULL
);


ALTER TABLE public."fieldLinks" OWNER TO postgres;

--
-- Name: fieldLinks_fieldLinkID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "fieldLinks_fieldLinkID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."fieldLinks_fieldLinkID_seq" OWNER TO postgres;

--
-- Name: fieldLinks_fieldLinkID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "fieldLinks_fieldLinkID_seq" OWNED BY "fieldLinks"."fieldLinkID";


--
-- Name: fieldScalars; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE "fieldScalars" (
    "fieldScalarID" bigint NOT NULL,
    "fieldID" bigint NOT NULL,
    type text NOT NULL,
    value double precision NOT NULL
);


ALTER TABLE public."fieldScalars" OWNER TO postgres;

--
-- Name: fieldScalars_fieldScalarID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "fieldScalars_fieldScalarID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."fieldScalars_fieldScalarID_seq" OWNER TO postgres;

--
-- Name: fieldScalars_fieldScalarID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "fieldScalars_fieldScalarID_seq" OWNED BY "fieldScalars"."fieldScalarID";


--
-- Name: fields; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE fields (
    "fieldID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    name text NOT NULL,
    value text NOT NULL,
    index tsvector NOT NULL
);


ALTER TABLE public.fields OWNER TO postgres;

--
-- Name: fields_fieldID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "fields_fieldID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."fields_fieldID_seq" OWNER TO postgres;

--
-- Name: fields_fieldID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "fields_fieldID_seq" OWNED BY fields."fieldID";


--
-- Name: fileURIs; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE "fileURIs" (
    "fileURIID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    "URIID" bigint NOT NULL
);


ALTER TABLE public."fileURIs" OWNER TO postgres;

--
-- Name: fileURIs_fileURIID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "fileURIs_fileURIID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."fileURIs_fileURIID_seq" OWNER TO postgres;

--
-- Name: fileURIs_fileURIID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "fileURIs_fileURIID_seq" OWNED BY "fileURIs"."fileURIID";


--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE files (
    "fileID" bigint NOT NULL,
    "internalHash" text NOT NULL,
    type text NOT NULL,
    size bigint NOT NULL
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: files_fileID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "files_fileID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."files_fileID_seq" OWNER TO postgres;

--
-- Name: files_fileID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "files_fileID_seq" OWNED BY files."fileID";


--
-- Name: pulls; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE pulls (
    "pullID" bigint NOT NULL,
    "userID" bigint NOT NULL,
    targets text NOT NULL,
    "URI" text NOT NULL,
    "queryString" text NOT NULL,
    "queryLanguage" text NOT NULL,
    username text NOT NULL,
    password text NOT NULL
);


ALTER TABLE public.pulls OWNER TO postgres;

--
-- Name: pulls_pullID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "pulls_pullID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."pulls_pullID_seq" OWNER TO postgres;

--
-- Name: pulls_pullID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "pulls_pullID_seq" OWNED BY pulls."pullID";


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE sessions (
    "sessionID" bigint NOT NULL,
    "sessionHash" text NOT NULL,
    "userID" bigint NOT NULL,
    "modeRead" boolean NOT NULL,
    "modeWrite" boolean NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
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
-- Name: submissions; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE submissions (
    "submissionID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    "userID" bigint NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.submissions OWNER TO postgres;

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

ALTER SEQUENCE "sources_sourceID_seq" OWNED BY submissions."submissionID";


--
-- Name: targets; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE targets (
    "targetID" bigint NOT NULL,
    "submissionID" bigint NOT NULL,
    "userID" bigint
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
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
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
-- Name: URIID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "URIs" ALTER COLUMN "URIID" SET DEFAULT nextval('"URIs_URIID_seq"'::regclass);


--
-- Name: fieldLinkID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "fieldLinks" ALTER COLUMN "fieldLinkID" SET DEFAULT nextval('"fieldLinks_fieldLinkID_seq"'::regclass);


--
-- Name: fieldScalarID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "fieldScalars" ALTER COLUMN "fieldScalarID" SET DEFAULT nextval('"fieldScalars_fieldScalarID_seq"'::regclass);


--
-- Name: fieldID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY fields ALTER COLUMN "fieldID" SET DEFAULT nextval('"fields_fieldID_seq"'::regclass);


--
-- Name: fileURIID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "fileURIs" ALTER COLUMN "fileURIID" SET DEFAULT nextval('"fileURIs_fileURIID_seq"'::regclass);


--
-- Name: fileID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY files ALTER COLUMN "fileID" SET DEFAULT nextval('"files_fileID_seq"'::regclass);


--
-- Name: pullID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY pulls ALTER COLUMN "pullID" SET DEFAULT nextval('"pulls_pullID_seq"'::regclass);


--
-- Name: sessionID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY sessions ALTER COLUMN "sessionID" SET DEFAULT nextval('"sessions_sessionID_seq"'::regclass);


--
-- Name: submissionID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY submissions ALTER COLUMN "submissionID" SET DEFAULT nextval('"sources_sourceID_seq"'::regclass);


--
-- Name: targetID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY targets ALTER COLUMN "targetID" SET DEFAULT nextval('"targets_targetID_seq"'::regclass);


--
-- Name: userID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY users ALTER COLUMN "userID" SET DEFAULT nextval('"users_userID_seq"'::regclass);


--
-- Name: URIsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "URIs"
    ADD CONSTRAINT "URIsPrimaryKey" PRIMARY KEY ("URIID");


--
-- Name: fieldLinksPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "fieldLinks"
    ADD CONSTRAINT "fieldLinksPrimaryKey" PRIMARY KEY ("fieldLinkID");


--
-- Name: fieldScalarsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "fieldScalars"
    ADD CONSTRAINT "fieldScalarsPrimaryKey" PRIMARY KEY ("fieldScalarID");


--
-- Name: fieldsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY fields
    ADD CONSTRAINT "fieldsPrimaryKey" PRIMARY KEY ("fieldID");


--
-- Name: filePrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY files
    ADD CONSTRAINT "filePrimaryKey" PRIMARY KEY ("fileID");


--
-- Name: fileURIsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "fileURIs"
    ADD CONSTRAINT "fileURIsPrimaryKey" PRIMARY KEY ("fileURIID");


--
-- Name: filesUniqueHashAndType; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY files
    ADD CONSTRAINT "filesUniqueHashAndType" UNIQUE ("internalHash", type);


--
-- Name: pullsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY pulls
    ADD CONSTRAINT "pullsPrimaryKey" PRIMARY KEY ("pullID");


--
-- Name: sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY ("sessionID");


--
-- Name: submissionsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY submissions
    ADD CONSTRAINT "submissionsPrimaryKey" PRIMARY KEY ("submissionID");


--
-- Name: targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY targets
    ADD CONSTRAINT targets_pkey PRIMARY KEY ("targetID");


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
-- Name: URIs_normalizedURI_idx; Type: INDEX; Schema: public; Owner: postgres; Tablespace: 
--

CREATE UNIQUE INDEX "URIs_normalizedURI_idx" ON "URIs" USING btree ("normalizedURI");


--
-- Name: URIsOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "URIsOnDuplicateDoNothing" AS ON INSERT TO "URIs" WHERE (EXISTS (SELECT 1 FROM "URIs" old WHERE (old."normalizedURI" = new."normalizedURI"))) DO INSTEAD NOTHING;


--
-- Name: fileURIsOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "fileURIsOnDuplicateDoNothing" AS ON INSERT TO "fileURIs" WHERE (EXISTS (SELECT 1 FROM "fileURIs" old WHERE ((old."fileID" = new."fileID") AND (old."URIID" = new."URIID")))) DO INSTEAD NOTHING;


--
-- Name: filesOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "filesOnDuplicateDoNothing" AS ON INSERT TO files WHERE (EXISTS (SELECT 1 FROM files old WHERE ((old."internalHash" = new."internalHash") AND (old.type = new.type)))) DO INSTEAD NOTHING;


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

