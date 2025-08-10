import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { debugLog } from '../utils/logger';

export interface SQLQueryResult {
  query: string;
  results: any[];
  rowCount: number;
  explanation: string;
  chartConfig?: {
    type: 'bar' | 'line' | 'pie';
    xAxisKey: string;
    yAxisKey: string;
    title: string;
  };
  summaryStats?: {
    [key: string]: number | string;
  };
}

export interface NaturalLanguageQueryRequest {
  question: string;
  includeChartConfig?: boolean;
}

export class NaturalLanguageSQLService {
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      console.log('🤖 NaturalLanguageSQLService initialized with API key');
    } else {
      console.error('❌ NaturalLanguageSQLService: No API key found in environment variables');
    }
  }

  async processNaturalLanguageQuery(request: NaturalLanguageQueryRequest): Promise<SQLQueryResult> {
    if (!this.client) {
      throw new Error('Anthropic API client not initialized. Please check your ANTHROPIC_API_KEY environment variable.');
    }

    const startTime = Date.now();
    console.log('\n🚀 === NATURAL LANGUAGE SQL QUERY START ===');
    console.log(`📝 Question: "${request.question}"`);

    try {
      // Get the SQL query from Anthropic
      const sqlQuery = await this.generateSQLQuery(request.question);
      console.log(`🔍 Generated SQL: ${sqlQuery}`);

      // Execute the query
      const results = await this.executeSQLQuery(sqlQuery);
      console.log(`📊 Query returned ${results.length} rows`);

      // Generate explanation and chart config
      const analysisResult = await this.analyzeResults(request.question, sqlQuery, results, request.includeChartConfig);

      const totalTime = Date.now() - startTime;
      console.log(`✅ Natural language SQL query complete: ${totalTime}ms`);

      return {
        query: sqlQuery,
        results: results,
        rowCount: results.length,
        explanation: analysisResult.explanation,
        chartConfig: analysisResult.chartConfig,
        summaryStats: analysisResult.summaryStats
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Natural language SQL query failed: ${totalTime}ms`);
      console.error('Error:', error);
      throw error;
    }
  }

  private async generateSQLQuery(question: string): Promise<string> {
    const systemPrompt = this.buildSQLGenerationPrompt();

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Convert this natural language question into a SQL query: "${question}"`
        }
      ]
    });

    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Anthropic API');
    }

    const responseText = (textContent as any).text;
    
    // Extract SQL from response (handle potential markdown code blocks)
    const sqlMatch = responseText.match(/```sql\s*([\s\S]*?)\s*```/) || 
                    responseText.match(/```\s*(SELECT[\s\S]*?)\s*```/) ||
                    responseText.match(/(SELECT[\s\S]*?)(?=\n\n|$)/);
    
    if (sqlMatch) {
      return sqlMatch[1].trim();
    }

    // If no code block, try to find SELECT statement
    const selectMatch = responseText.match(/SELECT[\s\S]*?(?=\n\n|$)/i);
    if (selectMatch) {
      return selectMatch[0].trim();
    }

    throw new Error('Could not extract SQL query from AI response');
  }

  private async executeSQLQuery(sqlQuery: string): Promise<any[]> {
    try {
      // Use Drizzle's raw SQL execution
      const result = await db.execute(sql.raw(sqlQuery));
      return result.rows || [];
    } catch (error) {
      console.error('SQL execution error:', error);
      throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeResults(
    question: string, 
    sqlQuery: string, 
    results: any[], 
    includeChartConfig: boolean = true
  ): Promise<{
    explanation: string;
    chartConfig?: any;
    summaryStats?: any;
  }> {
    const systemPrompt = `You are an expert data analyst. Your task is to analyze SQL query results and provide:
1. A clear explanation of what the data shows in response to the user's question
2. Summary statistics if relevant
3. Chart configuration recommendations if the data is suitable for visualization

Be concise but thorough. Focus on insights that answer the user's question.`;

    const userPrompt = `Question: "${question}"
SQL Query: ${sqlQuery}
Results: ${JSON.stringify(results.slice(0, 10), null, 2)}${results.length > 10 ? `\n... and ${results.length - 10} more rows` : ''}

Provide analysis in this JSON format:
{
  "explanation": "Clear explanation of what the data shows and insights",
  "summaryStats": {
    "key1": "value1",
    "key2": "value2"
  },
  ${includeChartConfig ? `"chartConfig": {
    "type": "bar|line|pie",
    "xAxisKey": "column_name_for_x_axis",
    "yAxisKey": "column_name_for_y_axis", 
    "title": "Chart title"
  }` : ''}
}

Only include chartConfig if the data is suitable for visualization (has numeric values and categorical data).`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No analysis response from Anthropic API');
    }

    const responseText = (textContent as any).text;
    
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to basic explanation
      return {
        explanation: responseText,
        summaryStats: {
          'Total Rows': results.length
        }
      };
    } catch (parseError) {
      console.error('Failed to parse analysis response:', parseError);
      return {
        explanation: `Query returned ${results.length} rows. ${responseText}`,
        summaryStats: {
          'Total Rows': results.length
        }
      };
    }
  }

  private buildSQLGenerationPrompt(): string {
    return `You are an expert SQL query generator for a landscaping business database. Convert natural language questions into PostgreSQL queries.

## Database Schema

### Tables and Columns:

**clients table:**
- id (serial, primary key)
- client_id (text, unique)
- name (text) - client name
- address (text)
- geo_zone (text) - geographical zone
- is_recurring_maintenance (boolean)
- maintenance_interval_weeks (integer)
- maintenance_hours_per_visit (text)
- maintenance_rate (text)
- active_status (text)
- created_at, updated_at (timestamps)

**employees table:**
- id (serial, primary key)
- employee_id (text, unique)
- name (text) - employee name
- regular_workdays (text)
- home_address (text)
- hourly_rate (real)
- capability_level (real)
- active_status (text)
- created_at, updated_at (timestamps)

**work_activities table:**
- id (serial, primary key)
- work_type (text) - maintenance, install, errand, office work, etc.
- date (text) - ISO date string
- status (text) - planned, in_progress, completed, invoiced
- start_time, end_time (text) - ISO time strings
- billable_hours (real)
- total_hours (real)
- hourly_rate (real)
- project_id (integer, FK to projects)
- client_id (integer, FK to clients)
- travel_time_minutes (integer)
- break_time_minutes (integer)
- notes (text)
- tasks (text)
- created_at, updated_at (timestamps)

**work_activity_employees table:**
- id (serial, primary key)
- work_activity_id (integer, FK to work_activities)
- employee_id (integer, FK to employees)
- hours (real)

**projects table:**
- id (serial, primary key)
- client_id (integer, FK to clients)
- status (text)
- name (text)
- description (text)
- created_at, updated_at (timestamps)

**other_charges table:**
- id (serial, primary key)
- work_activity_id (integer, FK to work_activities)
- charge_type (text) - material, service, debris, delivery, etc.
- description (text)
- quantity (real)
- unit_rate (real)
- total_cost (real)
- billable (boolean)

**invoices table:**
- id (serial, primary key)
- qbo_invoice_id (text)
- client_id (integer, FK to clients)
- invoice_number (text)
- status (text)
- total_amount (real)
- invoice_date (text)
- due_date (text)

**client_notes table:**
- id (serial, primary key)
- client_id (integer, FK to clients)
- note_type (text)
- title (text)
- content (text)
- date (text)

## Query Guidelines:

1. **Always use proper JOINs** when combining tables
2. **Date filtering**: Use proper date comparisons for date fields (stored as text in ISO format)
3. **Aggregations**: Use GROUP BY for counting, summing, averaging
4. **Filtering**: Use WHERE clauses for specific conditions
5. **Ordering**: Add ORDER BY for meaningful result ordering
6. **Limits**: Add LIMIT if appropriate to prevent huge result sets

## Example Queries:

"How many clients do we have?" → 
\`\`\`sql
SELECT COUNT(*) as client_count FROM clients WHERE active_status = 'active';
\`\`\`

"What are our top clients by billable hours this year?" →
\`\`\`sql
SELECT c.name, SUM(wa.billable_hours) as total_billable_hours
FROM clients c
JOIN work_activities wa ON c.id = wa.client_id
WHERE wa.date >= '2025-01-01' AND wa.billable_hours > 0
GROUP BY c.id, c.name
ORDER BY total_billable_hours DESC
LIMIT 10;
\`\`\`

"Show me work activities for this month" →
\`\`\`sql
SELECT wa.date, c.name as client_name, wa.work_type, wa.total_hours, wa.billable_hours
FROM work_activities wa
JOIN clients c ON wa.client_id = c.id
WHERE wa.date >= date_trunc('month', CURRENT_DATE)::text
  AND wa.date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::text
ORDER BY wa.date DESC;
\`\`\`

## Important Notes:
- Date fields are stored as text in ISO format (YYYY-MM-DD)
- Use proper casting when needed: date_field::date
- Always consider active_status filters where relevant
- Join tables appropriately to get meaningful names instead of IDs
- Be mindful of NULL values in optional fields

Return ONLY the SQL query, properly formatted with appropriate comments if complex.`;
  }
}