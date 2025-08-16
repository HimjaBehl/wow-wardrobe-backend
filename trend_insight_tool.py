import os
from langchain.tools import tool
from supabase import create_client
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Connect to Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

# Initialize embeddings model
embedding_model = OpenAIEmbeddings()

# Load vector store from Supabase (assumes table = "trends")
vectorstore = SupabaseVectorStore(
    client=supabase,
    table_name="trends",
    query_name="match_trends",  # This will work once we write a Postgres function
    embedding=embedding_model,
)

# Define LangChain tool
@tool
def get_trend_insights(query: str) -> str:
    """Returns trending fashion insights based on the user’s query."""
    results = vectorstore.similarity_search(query, k=3)

    print(f"🧠 Query: {query}")
    print(f"🔎 Results: {results}")

    if not results:
        return "No matching trends found in the database."

    insights = "\n\n".join([r.page_content for r in results])
    return insights
