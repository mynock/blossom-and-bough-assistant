// Pure extractors for Notion property/block shapes.
// Extracted from NotionSyncService for testability — no behavior change.

export function getSelectProperty(properties: any, propertyName: string): string | null {
  const prop = properties[propertyName];
  return prop?.select?.name || null;
}

export function getMultiSelectProperty(properties: any, propertyName: string): string[] {
  const prop = properties[propertyName];
  return prop?.multi_select?.map((item: any) => item.name) || [];
}

export function getTextProperty(properties: any, propertyName: string): string | null {
  const prop = properties[propertyName];
  if (prop?.rich_text?.length > 0) {
    return prop.rich_text.map((text: any) => text.plain_text).join('');
  }
  return null;
}

export function extractTextFromRichText(block: any): string {
  if (block.type === 'heading_1' && block.heading_1?.rich_text) {
    return block.heading_1.rich_text.map((text: any) => text.plain_text).join('');
  }
  if (block.type === 'heading_2' && block.heading_2?.rich_text) {
    return block.heading_2.rich_text.map((text: any) => text.plain_text).join('');
  }
  if (block.type === 'heading_3' && block.heading_3?.rich_text) {
    return block.heading_3.rich_text.map((text: any) => text.plain_text).join('');
  }
  if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
    return block.bulleted_list_item.rich_text.map((text: any) => text.plain_text).join('');
  }
  if (block.type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
    return block.numbered_list_item.rich_text.map((text: any) => text.plain_text).join('');
  }
  return '';
}
