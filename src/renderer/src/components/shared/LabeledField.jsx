import React from 'react';

export default function LabeledField({
  label,
  required = false,
  children,
  labelWidth = 'w-[110px]',
  topPadding = 'pt-2',
}) {
  return (
    <div className="flex items-start">
      <div className={`${labelWidth} flex-shrink-0 ${topPadding} text-right pr-4 text-gray-600 font-medium`}>
        {required && <span className="text-red-500 mr-1">*</span>}
        {label}
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
