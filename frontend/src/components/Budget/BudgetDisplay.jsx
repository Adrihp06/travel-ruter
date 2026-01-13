import React from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

const BudgetDisplay = ({ budget, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!budget) {
    return null;
  }

  const formatCurrency = (amount, currency) => {
    const symbols = { EUR: '\u20AC', USD: '$', GBP: '\u00A3', JPY: '\u00A5' };
    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${Number(amount).toFixed(2)}`;
  };

  const getStatusColor = (percentage) => {
    if (percentage === null || percentage === undefined) return 'gray';
    if (percentage >= 100) return 'red';
    if (percentage >= 80) return 'yellow';
    return 'green';
  };

  const statusColor = getStatusColor(budget.budget_percentage);

  const colorClasses = {
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      bar: 'bg-green-500',
      text: 'text-green-700',
      icon: 'text-green-500'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      bar: 'bg-yellow-500',
      text: 'text-yellow-700',
      icon: 'text-yellow-500'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      bar: 'bg-red-500',
      text: 'text-red-700',
      icon: 'text-red-500'
    },
    gray: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      bar: 'bg-gray-500',
      text: 'text-gray-700',
      icon: 'text-gray-500'
    }
  };

  const colors = colorClasses[statusColor];

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className={`w-5 h-5 ${colors.icon}`} />
          <h3 className="font-semibold text-gray-900">Trip Budget</h3>
        </div>
        {budget.budget_percentage !== null && budget.budget_percentage >= 100 && (
          <div className="flex items-center gap-1 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Over budget</span>
          </div>
        )}
      </div>

      {/* Budget vs Spent Display */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Total Budget (Estimated)</p>
          <p className="text-xl font-bold text-gray-900">
            {budget.total_budget
              ? formatCurrency(budget.total_budget, budget.currency)
              : formatCurrency(budget.estimated_total, budget.currency)}
          </p>
          {budget.total_budget && (
            <p className="text-xs text-gray-500 mt-1">
              POI Estimates: {formatCurrency(budget.estimated_total, budget.currency)}
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">Spent</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(budget.actual_total, budget.currency)}
          </p>
          {budget.remaining_budget !== null && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${budget.remaining_budget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {budget.remaining_budget >= 0 ? (
                <>
                  <TrendingDown className="w-3 h-3" />
                  {formatCurrency(budget.remaining_budget, budget.currency)} remaining
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3" />
                  {formatCurrency(Math.abs(budget.remaining_budget), budget.currency)} over
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Budget Comparison Display */}
      <div className="bg-white rounded-lg p-3 mb-4 border border-gray-100">
        <p className="text-sm font-medium text-gray-700">
          Budget: {formatCurrency(budget.total_budget || budget.estimated_total, budget.currency)} vs. Spent: {formatCurrency(budget.actual_total, budget.currency)}
        </p>
      </div>

      {/* Progress Bar */}
      {budget.budget_percentage !== null && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Budget Usage</span>
            <span className={colors.text}>{budget.budget_percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
              style={{ width: `${Math.min(budget.budget_percentage, 100)}%` }}
            />
          </div>
          {budget.budget_percentage > 100 && (
            <div className="mt-1 text-xs text-red-600">
              {(budget.budget_percentage - 100).toFixed(1)}% over budget
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BudgetDisplay;
